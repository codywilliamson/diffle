// worker entry: runs a regex search off the main thread so a pathological pattern can be terminated
// instead of freezing the server. receives the text up front, streams partial results back.

import type { DiffFile, SearchCase, SearchResponse } from "../types";
import { compilePattern } from "./search";
import { searchDiffFiles } from "./searchDiff";

export interface SearchWorkerRequest {
  files: DiffFile[];
  contents: Record<string, Uint8Array>; // keyed by contentKey(side, path)
  query: string;
  caseMode: SearchCase;
}

export type SearchWorkerMessage =
  | { type: "progress"; response: SearchResponse }
  | { type: "done"; response: SearchResponse }
  | { type: "error"; message: string };

declare const self: { onmessage: ((event: { data: SearchWorkerRequest }) => void) | null; postMessage(message: SearchWorkerMessage): void };

self.onmessage = ({ data }) => {
  try {
    const pattern = compilePattern(data.query, true, data.caseMode);
    const read = (path: string, side: string) => data.contents[`${side}:${path}`] ?? null;
    const response = searchDiffFiles(data.files, read, pattern, (progress) => {
      self.postMessage({ type: "progress", response: { results: [...progress.results], truncated: progress.truncated } });
    });
    self.postMessage({ type: "done", response });
  } catch (error) {
    self.postMessage({ type: "error", message: error instanceof Error ? error.message : String(error) });
  }
};
