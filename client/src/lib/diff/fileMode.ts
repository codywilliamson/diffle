import type { DiffFile, DiffMeta } from "$types";
import { isMarkdown } from "$lib/format";

export interface FileSplitState {
  global: boolean;
  override: boolean | null;
}

type DiffMode = DiffMeta["mode"] | undefined;

export function canPreviewMarkdown(file: DiffFile): boolean {
  return isMarkdown(file.path) && !file.binary && file.changeType !== "deleted";
}

export function canOverrideFileSplit(file: DiffFile, mode: DiffMode): boolean {
  return !file.binary && mode !== "browse" && file.changeType !== "added" && file.changeType !== "deleted";
}

export function createFileSplitState(global: boolean): FileSplitState {
  return { global, override: null };
}

export function syncGlobalSplit(state: FileSplitState, global: boolean): FileSplitState {
  return state.global === global ? state : { global, override: null };
}

export function resolveFileSplit(state: FileSplitState, file: DiffFile, mode: DiffMode): boolean {
  return canOverrideFileSplit(file, mode) && (state.override ?? state.global);
}

export function toggleFileSplit(state: FileSplitState, file: DiffFile, mode: DiffMode): FileSplitState {
  if (!canOverrideFileSplit(file, mode)) return state;
  return { ...state, override: !resolveFileSplit(state, file, mode) };
}
