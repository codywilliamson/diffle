import { NO_MOVED, type MovedLookup } from "./movedLines";

// what the analysis adds to a rendered diff; `readonly` drops commenting (interdiff view).
export interface DiffAnnotations {
  whitespaceHunks: ReadonlySet<number>;
  moved: MovedLookup;
  readonly: boolean;
}

export const PLAIN_ANNOTATIONS: DiffAnnotations = { whitespaceHunks: new Set(), moved: NO_MOVED, readonly: false };

// split rows are keyed "<hunk>-<row>[-comment]" or "<hunk>-header"
export const hunkOfRowKey = (key: string): number => Number.parseInt(key, 10);
