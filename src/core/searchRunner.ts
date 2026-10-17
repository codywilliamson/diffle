// main-thread side of regex search: hands the work to a worker and kills it when the total budget runs out.

import type { SearchResponse } from "../types";
import type { SearchWorkerMessage, SearchWorkerRequest } from "./searchWorker";

export const SEARCH_TOTAL_BUDGET_MS = 2_000;

// a compiled binary embeds the worker under its path relative to the build root, and the source url no longer resolves
const IN_COMPILED_BINARY = /~BUN|\$bunfs/.test(import.meta.dir);
const EMBEDDED_WORKER_PATH = "./src/core/searchWorker.ts";
const workerLocation = () => (IN_COMPILED_BINARY ? EMBEDDED_WORKER_PATH : new URL("./searchWorker.ts", import.meta.url));

export class SearchTimeoutError extends Error {}

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
    const timer = setTimeout(() => {
      finish(() => {
        if (latest && latest.results.length) resolve({ results: latest.results, truncated: true });
        else reject(new SearchTimeoutError("pattern took too long; try a simpler regex"));
      });
    }, budgetMs);
    worker.onmessage = ({ data }: MessageEvent<SearchWorkerMessage>) => {
      if (data.type === "progress") latest = data.response;
      else if (data.type === "done") finish(() => resolve(data.response));
      else finish(() => reject(new Error(data.message)));
    };
    worker.onerror = (event) => finish(() => reject(new Error(event.message || "search worker failed")));
    worker.postMessage(request);
  });
}
