// the durable Review Record store: initial load, stale-guarded polling, outcome transitions,
// unread-activity accumulation, and legacy .review adoption. the single source of the current
// record — the comments store adopts server responses back through here.

import type { ReviewStatus } from "$types";
import { getComments, type CommentsResponse } from "$lib/api/comments";
import { getReview, submitReviewOutcome, importLegacyReview, ignoreLegacyReview, removeLegacyReview } from "$lib/api/review";
import {
  isRecord, updatedAtOf, countUnresolved, commentsOf, emptyNotice, noticeHasContent,
  foldActivity, errorMessage, type ReviewData, type ActivityNotice,
} from "./reviewRecord";

const POLL_INTERVAL_MS = 3000;

export interface ReviewDeps {
  getComments: (signal?: AbortSignal) => Promise<CommentsResponse | null>;
  getReview: typeof getReview;
  submitReviewOutcome: typeof submitReviewOutcome;
  importLegacyReview: typeof importLegacyReview;
  ignoreLegacyReview: typeof ignoreLegacyReview;
  removeLegacyReview: typeof removeLegacyReview;
}

const realDeps: ReviewDeps = { getComments, getReview, submitReviewOutcome, importLegacyReview, ignoreLegacyReview, removeLegacyReview };

export function createReviewStore(deps: ReviewDeps = realDeps, initialReviewId?: string) {
  let record = $state<ReviewData | null>(null);
  let error = $state<string | null>(null);
  let notice = $state<ActivityNotice>(emptyNotice());
  let reviewId = $state<string | undefined>(initialReviewId);

  // bumps whenever reviewId changes, so an in-flight fetch can detect it was invalidated.
  let generation = 0;
  const seenActivity = new Set<string>();
  let timer: ReturnType<typeof setInterval> | null = null;

  // replace the current record. `notify` folds new agent activity into the unread notice;
  // reviewer-initiated adopts (load, outcomes, comment mutations) pass false.
  function adopt(next: ReviewData, notify = false): void {
    record = next;
    if (!isRecord(next)) return;
    const fresh = next.activity.filter((a) => !seenActivity.has(a.id));
    for (const a of fresh) seenActivity.add(a.id);
    if (notify) notice = foldActivity(notice, fresh);
  }

  const fetchLatest = (id: string | undefined) => (id ? deps.getReview(id) : deps.getComments());

  async function load(): Promise<void> {
    error = null;
    const gen = generation;
    try {
      const next = await fetchLatest(reviewId);
      if (gen !== generation) return; // reviewId changed mid-flight
      if (next) adopt(next, false);
      else record = null;
    } catch (e) {
      if (gen === generation) error = errorMessage(e);
    }
  }

  // fetch the latest and adopt only when it is at least as new as the current record, so an
  // overlapping poll can't clobber a newer local write. a reviewId change discards the result.
  async function poll(): Promise<void> {
    const gen = generation;
    let next: ReviewData | null;
    try {
      next = await fetchLatest(reviewId);
    } catch (e) {
      if (gen === generation) error = errorMessage(e);
      return;
    }
    if (gen !== generation) return; // invalidated by a reviewId change
    if (!next) return;
    if (record && updatedAtOf(next) < updatedAtOf(record)) return; // stale response
    adopt(next, true);
  }

  const tick = () => {
    if (document.visibilityState === "visible") void poll();
  };

  function startPolling(): void {
    if (timer) return;
    timer = setInterval(tick, POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", tick);
  }

  function stopPolling(): void {
    if (timer) clearInterval(timer);
    timer = null;
    document.removeEventListener("visibilitychange", tick);
  }

  // submit an outcome and adopt the returned record; a rejected transition surfaces the error
  // and leaves the current record untouched. legacy files have no outcomes.
  async function outcome(kind: "feedback" | "approved" | "cancelled", summary?: string, ack?: boolean): Promise<void> {
    if (!isRecord(record)) {
      error = "no active review record";
      return;
    }
    error = null;
    try {
      adopt(await deps.submitReviewOutcome(record.id, kind, summary, ack), false);
    } catch (e) {
      error = errorMessage(e);
    }
  }

  // run a legacy adapter, then apply its effect on the record (adopt an import, else clear).
  async function legacy(run: () => Promise<ReviewData | void>): Promise<void> {
    error = null;
    try {
      const next = await run();
      if (next) adopt(next, false);
      else record = null;
    } catch (e) {
      error = errorMessage(e);
    }
  }

  return {
    get record(): ReviewData | null {
      return record;
    },
    get isLegacy(): boolean {
      return record != null && !isRecord(record);
    },
    get status(): ReviewStatus | undefined {
      return isRecord(record) ? record.status : undefined;
    },
    get unresolvedCount(): number {
      return countUnresolved(commentsOf(record));
    },
    get error(): string | null {
      return error;
    },
    get notice(): ActivityNotice | null {
      return noticeHasContent(notice) ? notice : null;
    },
    get reviewId(): string | undefined {
      return reviewId;
    },
    setReviewId(id: string | undefined): void {
      if (id === reviewId) return;
      reviewId = id;
      generation++; // invalidate any in-flight load/poll
    },
    dismiss(): void {
      notice = emptyNotice();
    },
    adopt(next: ReviewData): void {
      adopt(next, false);
    },
    load,
    poll,
    startPolling,
    stopPolling,
    returnFeedback: (summary?: string) => outcome("feedback", summary),
    approve: (ack = false) => outcome("approved", undefined, ack),
    cancel: (summary?: string) => outcome("cancelled", summary),
    importLegacy: (id: string) => legacy(() => deps.importLegacyReview(id)),
    ignoreLegacy: () => legacy(async () => void (await deps.ignoreLegacyReview())),
    removeLegacy: (confirm = false) => legacy(async () => void (await deps.removeLegacyReview(confirm))),
  };
}

export type ReviewStore = ReturnType<typeof createReviewStore>;
