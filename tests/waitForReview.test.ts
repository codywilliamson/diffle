import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createReviewRecord, returnFeedback } from "../src/core/reviewRecords";
import { waitForReview } from "../src/core/waitForReview";
import { createPresence } from "../src/server/presence";

let data: string;
beforeAll(() => { data = mkdtempSync(join(tmpdir(), "nittle-waitfor-")); process.env.NITTLE_DATA_DIR = data; });
afterAll(() => { delete process.env.NITTLE_DATA_DIR; rmSync(data, { recursive: true, force: true }); });

const newReview = () => createReviewRecord({ target: { cwd: data, ref: "working" }, policy: "handoff" });

describe("waitForReview", () => {
  it("reports closed when a tab connected and left before waiting started", async () => {
    const review = newReview();
    const presence = createPresence();
    presence.add()();
    expect(await waitForReview({ reviewId: review.id, presence, graceMs: 50 })).toBe("closed");
  });

  it("prefers an already-returned outcome over the closed tab", async () => {
    const review = newReview();
    returnFeedback(review.id, "fix it");
    const presence = createPresence();
    presence.add()();
    expect(await waitForReview({ reviewId: review.id, presence, graceMs: 50 })).toBe("feedback");
  });
});
