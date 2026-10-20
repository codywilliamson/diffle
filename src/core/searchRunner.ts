// main-thread side of regex search: hands the work to a worker and kills it when the total budget runs out.

import type { DiffFile, SearchCase, SearchResponse } from "../types";
import type { SearchWorkerMessage, SearchWorkerRequest } from "./searchWorker";

// the budget covers search work only; spinning up the thread (slow on a loaded machine) has its own limit
export const SEARCH_TOTAL_BUDGET_MS = 2_000;
export const WORKER_STARTUP_LIMIT_MS = 15_000;

// a compiled binary embeds the worker under its path relative to the build root, and the source url no longer resolves
const IN_COMPILED_BINARY = /~BUN|\$bunfs/.test(import.meta.dir);
const EMBEDDED_WORKER_PATH = "./src/core/searchWorker.ts";
const workerLocation = () => (IN_COMPILED_BINARY ? EMBEDDED_WORKER_PATH : new URL("./searchWorker.ts", import.meta.url));

// the only per-file fields the worker needs; a patch can be tens of MB and must not be cloned along
export function toWorkerRequest(files: DiffFile[], contents: Record<string, ArrayBuffer>, query: string, caseMode: SearchCase): SearchWorkerRequest {
  return { files: files.map(({ path, oldPath, changeType, binary }) => ({ path, oldPath, changeType, binary })), contents, query, caseMode };
}

export class SearchTimeoutError extends Error {}
export class SearchBusyError extends Error {}

export const MAX_CONCURRENT_SEARCHES = 2;
export const MAX_QUEUED_SEARCHES = 4;

// admission control: at most MAX_CONCURRENT_SEARCHES run, MAX_QUEUED_SEARCHES wait, the rest are refused
// before they load anything. a slot is handed straight to the next waiter so the count never dips.
let running = 0;
const waiting: (() => void)[] = [];

async function acquireSlot(): Promise<void> {
  if (running < MAX_CONCURRENT_SEARCHES) {
    running += 1;
    return;
  }
  if (waiting.length >= MAX_QUEUED_SEARCHES) throw new SearchBusyError("too many searches running, try again");
  await new Promise<void>((resolve) => waiting.push(resolve));
}

function releaseSlot(): void {
  const next = waiting.shift();
  if (next) next();
  else running -= 1;
}

export async function withSearchSlot<T>(run: () => Promise<T>): Promise<T> {
  await acquireSlot();
  try {
    return await run();
  } finally {
    releaseSlot();
  }
}

// partial results on timeout come back with truncated: true; nothing found at all throws SearchTimeoutError.
export function runSearchInWorker(request: SearchWorkerRequest, budgetMs = SEARCH_TOTAL_BUDGET_MS): Promise<SearchResponse> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerLocation());
    let latest: SearchResponse | null = null;
    const finish = (settle: () => void) => {
      clearTimeout(timer);
      worker.terminate();
      settle();
    };
    const onBudgetExpired = () => {
      finish(() => {
        if (latest && latest.results.length) resolve({ results: latest.results, truncated: true });
        else reject(new SearchTimeoutError("pattern took too long; try a simpler regex"));
      });
    };
    let timer = setTimeout(() => finish(() => reject(new Error("search worker failed to start"))), WORKER_STARTUP_LIMIT_MS);
    worker.addEventListener("open", () => {
      clearTimeout(timer);
      timer = setTimeout(onBudgetExpired, budgetMs);
    }, { once: true });
    worker.onmessage = ({ data }: MessageEvent<SearchWorkerMessage>) => {
      if (data.type === "progress") latest = data.response;
      else if (data.type === "done") finish(() => resolve(data.response));
      else finish(() => reject(new Error(data.message)));
    };
    worker.onerror = (event) => finish(() => reject(new Error(event.message || "search worker failed")));
    worker.postMessage(request, Object.values(request.contents));
  });
}
