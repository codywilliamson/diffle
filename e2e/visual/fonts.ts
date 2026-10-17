import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";

const FONT_DIR = join(dirname(fileURLToPath(import.meta.url)), "fonts");
const FONT_HOST = "https://fonts.gstatic.com";
const FONT_URL_PREFIX = `${FONT_HOST}/e2e/`;

// the app loads DM Sans, IBM Plex Mono and Source Serif 4 from google fonts. the latin subsets
// are vendored in ./fonts (all SIL OFL) and served in their place, so renders never depend on
// the network or on which system fonts the machine happens to have.
const FACES: { family: string; file: string; weight: string }[] = [
  { family: "DM Sans", file: "dm-sans.woff2", weight: "400 600" },
  { family: "IBM Plex Mono", file: "plex-mono-400.woff2", weight: "400" },
  { family: "IBM Plex Mono", file: "plex-mono-500.woff2", weight: "500" },
  { family: "IBM Plex Mono", file: "plex-mono-600.woff2", weight: "600" },
  { family: "Source Serif 4", file: "source-serif-4.woff2", weight: "400 700" },
];

const FONT_CSS = FACES.map(
  (f) => `@font-face { font-family: '${f.family}'; font-style: normal; font-weight: ${f.weight}; font-display: block; src: url(${FONT_URL_PREFIX}${f.file}) format('woff2'); }`,
).join("\n");

export async function routeFonts(page: Page): Promise<void> {
  await page.route("https://fonts.googleapis.com/**", (route) => route.fulfill({ contentType: "text/css", body: FONT_CSS }));
  await page.route(`${FONT_HOST}/**`, (route) => {
    const file = basename(new URL(route.request().url()).pathname);
    return route.fulfill({ path: join(FONT_DIR, file), contentType: "font/woff2" });
  });
}
