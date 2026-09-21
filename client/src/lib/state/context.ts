import { getContext, setContext } from "svelte";
import type { DiffResult } from "$types";
import { createPrefsStore, type PrefsStore } from "./prefs.svelte";
import { createUiStore, type UiStore } from "./ui.svelte";
import { createDiffStore, type DiffStore } from "./diff.svelte";
import { createReviewStore, type ReviewStore } from "./review.svelte";
import { createCommentsStore, type CommentsStore } from "./comments.svelte";

// the five domain stores, composed once at the app root and shared through svelte context
// so components read them without prop drilling or a process-global singleton.
export interface AppState {
  prefs: PrefsStore;
  ui: UiStore;
  diff: DiffStore;
  review: ReviewStore;
  comments: CommentsStore;
}

const KEY = Symbol("diffle-app-state");

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
  return { prefs, ui, diff, review, comments };
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
