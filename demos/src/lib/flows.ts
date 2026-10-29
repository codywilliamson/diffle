// multi-step review flows on the showcase fixture, shared by the stills and the video drivers so a
// still and its take always show the same state.
import type { Page } from "playwright";
import { editFixture } from "./backend";
import { SERVER_ROUND_TWO } from "./showcase";

export const SERVER_FILE = "src/server.ts";
export const ROUND_ONE_COMMENT = "add a Retry-After header";
export const ROUND_ONE_SUMMARY = "Close. One change on the 429 before this ships.";
export const SUGGEST_NOTE = "send Retry-After so clients back off";
export const SUGGESTED_LINE = `        return new Response("rate limited", { status: 429, headers: { "Retry-After": "1" } });`;

export const changedChip = (page: Page) => page.locator(".chip-changed").first();
export const editor = (page: Page) => page.getByRole("textbox", { name: "Comment text" });

// hand the review back to the agent from the review menu.
export async function returnFeedback(page: Page, summary = ROUND_ONE_SUMMARY, delay = 0): Promise<void> {
  await page.getByRole("button", { name: /Review menu/ }).click();
  const box = page.getByRole("textbox", { name: "Reviewer summary" });
  await box.waitFor();
  if (delay) await box.pressSequentially(summary, { delay });
  else await box.fill(summary);
  await page.getByRole("button", { name: "Return Feedback" }).click();
  await page.getByRole("button", { name: /Review menu — Feedback/ }).waitFor().catch(() => {});
  await page.keyboard.press("Escape");
}

// the agent's second round: it edits the file on disk, then the reviewer re-runs the diff (r).
export async function agentRoundTwo(page: Page, fixture: string): Promise<void> {
  editFixture(fixture, SERVER_FILE, SERVER_ROUND_TWO);
  await page.keyboard.press("r");
  await changedChip(page).waitFor({ timeout: 10_000 });
}
