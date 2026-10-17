import type { Comment } from "../../src/types";
import type { FixtureFile } from "../harness";

// the page clock is pinned here, so relative times ("2 days ago") render the same on every run.
export const FIXED_NOW = new Date("2026-01-15T12:00:00Z");

export const isoDaysAgo = (daysAgo: number): string => new Date(FIXED_NOW.getTime() - daysAgo * 86_400_000).toISOString();

const GREETER_BASE = `export function greet(name: string): string {
  const greeting = "Hello";
  return \`\${greeting}, \${name}\`;
}

export function farewell(name: string): string {
  return \`Goodbye, \${name}\`;
}
`;

const GREETER_WORK = `export function greet(name: string, punctuation = "!"): string {
  const greeting = "Hello there";
  return \`\${greeting}, \${name}\${punctuation}\`;
}

export function farewell(name: string): string {
  return \`See you soon, \${name}\`;
}

export function shout(name: string): string {
  return greet(name).toUpperCase();
}
`;

const GREETER_TEST = `import { expect, test } from "bun:test";
import { greet, shout } from "./greeter";

test("greet adds punctuation", () => {
  expect(greet("Ada")).toBe("Hello there, Ada!");
});

test("shout is loud", () => {
  expect(shout("Ada")).toBe("HELLO THERE, ADA!");
});
`;

export const STANDARD_FILES: FixtureFile[] = [
  { path: "src/greeter.ts", base: GREETER_BASE, work: GREETER_WORK },
  { path: "src/greeter.test.ts", work: GREETER_TEST },
];

// one near-identical pair of lines per case, so intra-line word marks are the whole story.
export const WORD_DIFF_FILES: FixtureFile[] = [
  {
    path: "src/limits.ts",
    base: `export const MAX_RETRIES = 3;\nexport const TIMEOUT_MS = 1500;\nexport const BASE_URL = "https://api.example.com/v1";\nexport const ENABLED = true;\n`,
    work: `export const MAX_RETRIES = 5;\nexport const TIMEOUT_MS = 2500;\nexport const BASE_URL = "https://api.example.com/v2";\nexport const ENABLED = false;\n`,
  },
];

export const MARKDOWN_FILES: FixtureFile[] = [
  {
    path: "docs/guide.md",
    base: "# Guide\n\nStart here.\n",
    work: "# Guide\n\nStart here, then read the **review checklist**.\n\n## Checklist\n\n- read the diff\n- leave comments\n- return feedback\n\n> keep each comment to one idea\n\nSee [the docs](https://example.com/docs) for more.\n",
  },
];

export const LARGE_FILES: FixtureFile[] = [
  { path: "data/big.txt", base: "seed\n", work: `${Array.from({ length: 2100 }, (_, i) => `line ${i}`).join("\n")}\n` },
];

const lineComment = (patch: Partial<Comment> & Pick<Comment, "id" | "line" | "lineContent" | "text">): Comment => ({
  file: "src/greeter.ts",
  side: "new",
  createdAt: isoDaysAgo(2),
  ...patch,
});

const COMMENTS = {
  single: lineComment({
    id: "c-single",
    line: 3,
    lineContent: "+  return `${greeting}, ${name}${punctuation}`;",
    text: "Should the punctuation default live in a named constant?",
    tag: "question",
  }),
  range: lineComment({
    id: "c-range",
    line: 2,
    endLine: 3,
    lineContent: '+  const greeting = "Hello there";',
    text: "These two lines read better as one template literal.",
    tag: "nit",
  }),
  addressed: lineComment({
    id: "c-addressed",
    line: 7,
    lineContent: "+  return `See you soon, ${name}`;",
    text: "Is the new farewell wording agreed with the copy team?",
    tag: "issue",
    status: "addressed",
    replies: [
      { id: "r-1", author: "agent", text: "Yes, the copy team signed off in the review thread. Pushed a comment linking the decision.", createdAt: isoDaysAgo(1) },
    ],
  }),
};

export const COMMENTS_SINGLE = [COMMENTS.single];
export const COMMENTS_RANGE = [COMMENTS.range];
export const COMMENTS_ADDRESSED = [COMMENTS.addressed];
export const COMMENTS_MIXED = [COMMENTS.single, COMMENTS.range, COMMENTS.addressed];
