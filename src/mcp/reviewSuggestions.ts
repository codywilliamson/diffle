import type { ReviewRecord, ReviewSuggestion } from "../types";
import { hasSuggestionFence } from "../core/suggestions";
import { collectSuggestions } from "../core/suggestionPrompt";
import { loadReviewTarget } from "../core/reviewTarget";

export interface SuggestionsResult { suggestions: ReviewSuggestion[]; suggestionsError?: string }

// the structured suggestion blocks of a review's open line comments. the diff is re-read from
// the review's stored spec (absent means the working tree, never the display label in `ref`) so
// each block carries the lines it replaces. a failure comes back as `suggestionsError`.
export function suggestionsFor(review: ReviewRecord): SuggestionsResult {
  const candidates = review.comments.filter((c) => c.line !== null && hasSuggestionFence(c.text));
  if (candidates.length === 0) return { suggestions: [] };
  try {
    const { diff } = loadReviewTarget(review.target.cwd, review.target.spec);
    const { suggestions, errors } = collectSuggestions(diff, candidates);
    return errors.length > 0 ? { suggestions, suggestionsError: errors.join("; ") } : { suggestions };
  } catch (error) {
    return { suggestions: [], suggestionsError: `could not read the review's diff: ${error instanceof Error ? error.message : String(error)}` };
  }
}
