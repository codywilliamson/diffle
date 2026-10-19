import type { ReviewRecord, ReviewSuggestion } from "../types";
import { hasSuggestionFence } from "../core/suggestions";
import { collectSuggestions } from "../core/suggestionPrompt";
import { loadReviewTarget } from "../core/reviewTarget";

// the structured suggestion blocks of a review's open line comments. the diff is re-read from
// the review's target so each block carries the lines it replaces; if that fails the record
// still comes back, just without suggestions.
export function suggestionsFor(review: ReviewRecord): ReviewSuggestion[] {
  const candidates = review.comments.filter((c) => c.line !== null && hasSuggestionFence(c.text));
  if (candidates.length === 0) return [];
  try {
    const { diff } = loadReviewTarget(review.target.cwd, review.target.spec ?? review.target.ref);
    return collectSuggestions(diff, candidates);
  } catch {
    return [];
  }
}
