import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Comment, ReviewRecord } from "../../src/types";
import { dataDirFor } from "../harness";
import { isoDaysAgo } from "./fixtures";

const RECORD_FILE = "review.json";
const RECORD_AGE_DAYS = 3;

// the server creates the review record at launch with real timestamps. rewrite it in place with
// fixed dates and the given comments, so what the page renders (relative times, activity) never moves.
export function seedReviewRecord(fixture: string, comments: Comment[]): void {
  const reviewsDir = join(dataDirFor(fixture), "reviews");
  const [id] = readdirSync(reviewsDir);
  if (!id) throw new Error(`no review record created under ${reviewsDir}`);
  const path = join(reviewsDir, id, RECORD_FILE);
  const record = JSON.parse(readFileSync(path, "utf8")) as ReviewRecord;
  record.createdAt = isoDaysAgo(RECORD_AGE_DAYS);
  record.updatedAt = isoDaysAgo(1);
  record.activity = record.activity.map((entry) => ({ ...entry, createdAt: record.createdAt }));
  record.comments = comments;
  writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`);
}
