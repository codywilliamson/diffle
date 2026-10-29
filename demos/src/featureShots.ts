// the launch feature stills: one real-app screenshot per headline review aid, on the showcase
// fixture. light theme unless the id ends in -dark. called from screenshots.ts.
import type { Browser, Page } from "playwright";
import { openSession, shoot, type SessionOptions } from "./lib/shotSession";
import { SHOWCASE, SHOWCASE_CHURN, SHOWCASE_COMMIT, SHOWCASE_SEARCH, SHOWCASE_LIMITER_LINE, SHOWCASE_IP_LINE, SHOWCASE_429_LINE } from "./lib/showcase";
import { cursorTo, pickFile, wordBox } from "./lib/dom";
import {
  SERVER_FILE, ROUND_ONE_COMMENT, SUGGEST_NOTE, SUGGESTED_LINE, changedChip, editor, returnFeedback, agentRoundTwo,
} from "./lib/flows";

type Theme = "light" | "dark";
type Shot = (page: Page, fixture: string) => Promise<void>;

const ready = (page: Page) => page.locator("tr.diff-row").first().waitFor();

async function scorecard(page: Page): Promise<void> {
  await page.keyboard.press("g");
  await page.keyboard.press("c");
  const dialog = page.getByRole("dialog").first();
  await dialog.waitFor();
  // open the tests band so a reason list shows under it
  await dialog.getByText("Tests", { exact: true }).click();
}

async function reviewOrder(page: Page): Promise<void> {
  await page.keyboard.press("m");
  await page.getByText("Generated & lockfiles").waitFor();
}

async function searchAll(page: Page): Promise<void> {
  await page.keyboard.press("g");
  await page.keyboard.press("/");
  await page.keyboard.type(SHOWCASE_SEARCH);
  await page.locator("[data-search-all-count]").filter({ hasText: /match/ }).waitFor();
}

async function onLimiterLine(page: Page): Promise<void> {
  await pickFile(page, "server");
  await cursorTo(page, SERVER_FILE, SHOWCASE_LIMITER_LINE);
  const word = await wordBox(page, SERVER_FILE, SHOWCASE_LIMITER_LINE, "createLimiter");
  await page.mouse.move(word.x + word.width / 2, word.y + word.height / 2);
}

async function hover(page: Page): Promise<void> {
  await onLimiterLine(page);
  await page.locator("[data-hover-card]").filter({ hasText: "token-bucket" }).waitFor({ timeout: 20_000 });
}

async function references(page: Page): Promise<void> {
  await onLimiterLine(page);
  await page.locator("[data-hover-card]").waitFor({ timeout: 20_000 });
  await page.keyboard.press("g");
  await page.keyboard.press("A");
  await page.locator("[data-references-panel] [data-reference-group]").nth(2).waitFor({ timeout: 20_000 });
  await page.mouse.move(1430, 890); // park the pointer so the hover card stays away
}

async function suggestion(page: Page): Promise<void> {
  await pickFile(page, "server");
  await cursorTo(page, SERVER_FILE, SHOWCASE_429_LINE);
  await page.keyboard.press("c");
  await editor(page).fill(SUGGEST_NOTE);
  await page.getByRole("button", { name: "Suggest change" }).click();
  await page.keyboard.type(SUGGESTED_LINE);
  await page.keyboard.press("Control+Enter");
  await page.locator(".comment-card .suggestion").first().waitFor();
}

async function keyboardCursor(page: Page): Promise<void> {
  await pickFile(page, "server");
  await cursorTo(page, SERVER_FILE, SHOWCASE_IP_LINE);
  await page.keyboard.press("c");
  await editor(page).pressSequentially("trust only the proxy's header here");
}

async function sinceLastReview(page: Page, fixture: string): Promise<void> {
  await pickFile(page, "server");
  await cursorTo(page, SERVER_FILE, SHOWCASE_429_LINE);
  await page.keyboard.press("c");
  await editor(page).fill(ROUND_ONE_COMMENT);
  await page.keyboard.press("Control+Enter");
  await returnFeedback(page);
  await agentRoundTwo(page, fixture);
  await page.locator(`[data-file-path="${SERVER_FILE}"]`).first().scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Show only changes since last review" }).first().click();
  await changedChip(page).scrollIntoViewIfNeeded();
}

async function noiseMoved(page: Page): Promise<void> {
  const generated = page.locator("section.file-section", { has: page.getByText("src/db/schema.generated.ts") }).first();
  await generated.evaluate((el) => el.scrollIntoView({ block: "start" }));
}

async function showCommit(page: Page): Promise<void> {
  await page.getByRole("region", { name: "Commit" }).waitFor();
}

interface Still {
  id: string;
  theme: Theme;
  shot: Shot;
  options?: SessionOptions;
}

const still = (id: string, shot: Shot, options?: SessionOptions): Still[] => [{ id, theme: "light", shot, options }];
const both = (id: string, shot: Shot): Still[] => [...still(id, shot), { id: `${id}-dark`, theme: "dark", shot }];

export const FEATURE_STILLS: Still[] = [
  ...both("overview", async () => {}),
  ...both("scorecard", scorecard),
  ...still("review-order", reviewOrder),
  ...still("search-all", searchAll),
  ...still("code-nav-hover", hover),
  ...still("code-nav-references", references),
  ...still("suggestion", suggestion),
  ...still("keyboard-cursor", keyboardCursor),
  ...still("since-last-review", sinceLastReview),
  ...still("noise-moved", noiseMoved),
  ...still("show-commit", showCommit, { commit: SHOWCASE_COMMIT, args: ["show", "HEAD"] }),
];

export async function captureFeatureStills(browser: Browser, dir: string, only?: string): Promise<void> {
  for (const s of FEATURE_STILLS.filter((f) => !only || f.id === only)) {
    const { page, fixture, teardown } = await openSession(browser, SHOWCASE, { churn: SHOWCASE_CHURN, theme: s.theme, ...s.options });
    try {
      await ready(page);
      await page.waitForTimeout(800); // let analysis chips + highlighting settle
      await s.shot(page, fixture);
      await shoot(page, dir, s.id);
    } finally {
      await teardown();
    }
  }
}
