import { getContext, setContext } from "svelte";
import type { DiffResult } from "$types";
import { createPrefsStore, type PrefsStore } from "./prefs.svelte";
import { createUiStore, type UiStore } from "./ui.svelte";
import { createDiffStore, type DiffStore } from "./diff.svelte";
import { createReviewStore, type ReviewStore } from "./review.svelte";
import { createCommentsStore, type CommentsStore } from "./comments.svelte";
import { createAnalysisStore, type AnalysisStore } from "./analysis.svelte";
import { createCursorStore, type CursorStore } from "./cursor.svelte";
import { createCommentFocus, type CommentFocus } from "./commentFocus.svelte";
import { createFilePicker, type FilePicker } from "./filePicker.svelte";
import { createSearchAllStore, type SearchAllStore } from "./searchAll.svelte";
import { createSearchStore, type SearchStore } from "./search.svelte";
import { navigationStamp } from "$lib/lsp/stamp";
import { createLspStore, type LspStore } from "$lib/lsp/lsp.svelte";
import { reviewOrder } from "$lib/diff/reviewOrder";
import { canOverrideFileSplit } from "$lib/diff/fileMode";

// the domain stores, composed once at the app root and shared through svelte context
// so components read them without prop drilling or a process-global singleton.
export interface AppState {
  prefs: PrefsStore;
  ui: UiStore;
  diff: DiffStore;
  review: ReviewStore;
  comments: CommentsStore;
  analysis: AnalysisStore;
  cursor: CursorStore;
  search: SearchStore;
  searchAll: SearchAllStore;
  lsp: LspStore;
  commentFocus: CommentFocus;
  filePicker: FilePicker;
}

const KEY = Symbol("nittle-app-state");

// the durable Review Record for this launch is selected by the ?review= query.
function reviewIdFromUrl(): string | undefined {
  if (typeof location === "undefined") return undefined;
  return new URLSearchParams(location.search).get("review") ?? undefined;
}

export function createAppState(reviewId = reviewIdFromUrl()): AppState {
  const prefs = createPrefsStore();
  const ui = createUiStore();
  const diff = createDiffStore();
  const review = createReviewStore(undefined, reviewId);
  const currentDiff = (): DiffResult | null => {
    const state = diff.state;
    return state.status === "ready" ? state.diff : null;
  };
  const comments = createCommentsStore(review, currentDiff);
  const analysis = createAnalysisStore();
  const cursor = createCursorStore({
    files: () => (prefs.fileOrder === "review" ? reviewOrder(diff.files, analysis.scorecard) : diff.files),
    defaultSplit: (file) => prefs.split && canOverrideFileSplit(file, diff.meta?.mode),
    activePath: () => ui.activeFile,
    follow: (path) => ui.followFile(path),
    open: (path) => ui.requestOpen(path),
  });
  const search = createSearchStore({
    file: (path) => diff.files.find((file) => file.path === path),
    cursorPos: () => cursor.pos,
    goToLine: cursor.goToLine,
  });
  const searchAll = createSearchAllStore({ jump: cursor.goToHit });
  const lsp = createLspStore({
    files: () => diff.files,
    goToHit: cursor.goToHit,
    markJump: () => cursor.markJump(undefined),
    stamp: () => navigationStamp(cursor, ui),
    closeSearch: () => {
      search.close();
      searchAll.close();
    },
  });
  const commentFocus = createCommentFocus({ comments: () => comments.anchored, pos: () => cursor.pos });
  const filePicker = createFilePicker({ files: () => diff.files.map((file) => file.path), jump: cursor.goToFile });
  return { prefs, ui, diff, review, comments, analysis, cursor, search, searchAll, lsp, commentFocus, filePicker };
}

// call during component init at the app root.
export function setAppState(state: AppState): AppState {
  return setContext(KEY, state);
}

export function getAppState(): AppState {
  const state = getContext<AppState | undefined>(KEY);
  if (!state) throw new Error("app state was not provided — call setAppState at the app root");
  return state;
}
