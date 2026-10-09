// FileAnalysis builder for scorecard and ordering tests.

import type { ChangeFlag, FileAnalysis, FlagKind } from "../../../src/types";

export function analysis(path: string, over: Partial<FileAnalysis> = {}): FileAnalysis {
  return {
    path, language: "generic", group: "g", noise: null, whitespaceOnlyHunks: [], noiseLines: 0,
    effectiveLines: 10, testPair: null, isTest: false, churn: 0, changedSinceReview: null, flags: [], ...over,
  };
}

export const flag = (kind: FlagKind, reason: string = kind): ChangeFlag => ({ kind, reason, line: null });
