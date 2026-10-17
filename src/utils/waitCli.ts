// `--wait`: runs a launched review to its hand-off, prints the result on stdout (status lines go
// to stderr) and returns the process exit code.

import type { ReviewLaunch } from "../core/reviewLaunch";
import { PRODUCT } from "../core/product";
import { compileReviewPrompt } from "../core/promptCompiler";
import { readReviewRecord } from "../core/reviewRecords";
import { waitForReview, TAB_CLOSE_GRACE_MS, type WaitOutcome } from "../core/waitForReview";
import { found } from "../mcp/reviewOperations";
import { EXIT_CANCELLED, EXIT_RETURNED, EXIT_TAB_CLOSED } from "../core/waitExit";
import { productEnv } from "./env";

const RESPONSE_FLUSH_MS = 100;

const EXIT_BY_OUTCOME: Record<WaitOutcome, number> = {
  feedback: EXIT_RETURNED, approved: EXIT_RETURNED, cancelled: EXIT_CANCELLED, closed: EXIT_TAB_CLOSED,
};

export const resumeHint = (reviewId: string) =>
  `review ${reviewId} is still open. resume with: ${PRODUCT.name} --review-id ${reviewId} (or get_review over MCP)`;

// test hook: the grace period is overridable so the tab-closed path doesn't take five seconds.
function graceMs(): number {
  const raw = productEnv("WAIT_GRACE_MS");
  const override = raw === undefined ? NaN : Number(raw);
  return override >= 0 ? override : TAB_CLOSE_GRACE_MS;
}

function stdoutFor(launch: ReviewLaunch, outcome: WaitOutcome, json: boolean): string {
  if (outcome === "closed") return "";
  const id = launch.review.id;
  const record = readReviewRecord(id);
  if (json) return `${JSON.stringify(found(id))}\n`;
  if (outcome !== "feedback" || !record) return "";
  const review = { meta: { ref: record.target.ref, createdAt: record.createdAt, updatedAt: record.updatedAt }, viewed: record.viewed, comments: record.comments };
  return `${compileReviewPrompt(launch.ctx.diff, review, record.summary)}\n`;
}

export async function runWait(launch: ReviewLaunch, json: boolean, say: (line: string) => void): Promise<number> {
  const id = launch.review.id;
  say(`waiting for feedback on review ${id} (ctrl+c to stop)`);
  const outcome = await waitForReview({ reviewId: id, presence: launch.ctx.presence!, graceMs: graceMs() });
  process.stdout.write(stdoutFor(launch, outcome, json));
  await Bun.sleep(RESPONSE_FLUSH_MS); // let the reviewer's own request get its response before we exit
  if (outcome === "closed") say(`tab closed without returning feedback. ${resumeHint(id)}`);
  else say(`review ${outcome === "feedback" ? "sent back with feedback" : outcome}`);
  return EXIT_BY_OUTCOME[outcome];
}
