// client-only demo diff for ?radar-demo=1. shapes match src/types.ts DiffResult but this is a
// throwaway display fixture, not a shared contract — the integrating agent replaces it with real data.

const c = (o, n, content) => ({ type: "context", oldLine: o, newLine: n, content });
const a = (n, content) => ({ type: "addition", oldLine: null, newLine: n, content });
const d = (o, content) => ({ type: "deletion", oldLine: o, newLine: null, content });
const file = (path, changeType, additions, deletions, hunks) => ({ path, oldPath: null, changeType, additions, deletions, hunks });

export const FIXTURE_DIFF = {
  ref: "feature/radar → main",
  meta: { repo: "codywilliamson/loupe", mode: "branch", source: "feature/radar", target: "main" },
  files: [
    file("src/server/sessionHandlers.ts", "modified", 3, 1, [
      { header: "@@ -44,6 +44,9 @@ export async function stopSession", lines: [
        c(44, 44, "export async function stopSession(id: string) {"),
        c(45, 45, "  const session = readSession(id);"),
        d(46, "  if (!session) return false;"),
        a(46, '  if (!session) throw new Error("session missing");'),
        a(47, "  const child = children.get(id);"),
        a(48, "  child?.kill();"),
        c(47, 49, "  await removeSession(id);"),
        c(48, 50, "  return true;"),
        c(49, 51, "}"),
      ] },
    ]),
    file("src/core/reviewRecords.ts", "modified", 4, 1, [
      { header: "@@ -128,4 +128,7 @@ export function writeRecord", lines: [
        c(128, 128, "export function writeRecord(record: ReviewRecord) {"),
        c(129, 129, "  const file = recordPath(record.id);"),
        d(130, "  writeFileSync(file, JSON.stringify(record));"),
        a(130, "  const next = { ...record, updatedAt: new Date().toISOString() };"),
        a(131, "  const tmp = `${file}.${process.pid}.tmp`;"),
        a(132, "  writeFileSync(tmp, JSON.stringify(next, null, 2));"),
        a(133, "  renameSync(tmp, file);"),
        c(131, 134, "}"),
      ] },
    ]),
    file("src/client/reviewSync.js", "modified", 3, 1, [
      { header: "@@ -44,4 +44,6 @@ export function useReviewSync", lines: [
        c(44, 44, "  const poll = useCallback(() => {"),
        c(45, 45, "    if (!reviewId) return;"),
        a(46, "    const generation = generationRef.current;"),
        a(47, "    getReview(reviewId).then((next) => {"),
        a(48, "      if (generation !== generationRef.current) return;"),
        d(46, "    getReview(reviewId).then(setRecord);"),
        c(47, 49, "    }).catch(() => {});"),
      ] },
    ]),
    file("tests/sessions.test.ts", "added", 8, 0, [
      { header: "@@ -0,0 +1,8 @@", lines: [
        a(1, 'import { test, expect } from "bun:test";'),
        a(2, 'import { stopSession } from "../src/server/sessionHandlers";'),
        a(3, ""),
        a(4, 'test("stopSession throws on a missing id", async () => {'),
        a(5, '  await expect(stopSession("nope")).rejects.toThrow();'),
        a(6, "});"),
        a(7, ""),
        a(8, "// fixture: session dump loaded from tests/fixtures/dump.json"),
      ] },
    ]),
    file("src/client/motion.css", "modified", 2, 2, [
      { header: "@@ -6,4 +6,4 @@ :root {", lines: [
        c(6, 6, "  --duration-quick: 150ms;"),
        d(7, "  --duration-fast: 250ms;"),
        d(8, "  --duration-medium: 350ms;"),
        a(7, "  --duration-medium: 350ms;"),
        a(8, "  --duration-fast: 250ms;"),
        c(9, 9, "  --duration-slow: 400ms;"),
      ] },
    ]),
    file("src/config/providerKeys.ts", "modified", 1, 0, [
      { header: "@@ -12,3 +12,4 @@ export const providerKeys", lines: [
        c(12, 12, "export const providerKeys = {"),
        c(13, 13, "  openrouter: process.env.OPENROUTER_KEY ?? \"\","),
        a(14, '  fallback: "sk-or-v1-9f2c0b4e...redacted",'),
        c(14, 15, "};"),
      ] },
    ]),
  ],
};

const now = Date.now();
const iso = (minsAgo) => new Date(now - minsAgo * 60000).toISOString();

// two realistic reviewer comments so tree dots + inline threads render in the demo.
export const FIXTURE_COMMENTS = [
  { id: "demo-c1", file: "src/server/sessionHandlers.ts", side: "new", line: 46, endLine: 46,
    lineContent: '+  if (!session) throw new Error("session missing");', tag: "issue",
    text: "This turns a recoverable return into a throw — are all callers wrapped?", createdAt: iso(12) },
  { id: "demo-c2", file: "src/core/reviewRecords.ts", side: "new", line: null, endLine: null,
    lineContent: null, tag: "question", text: "Do we fsync before the rename on crash-prone hosts?", createdAt: iso(6) },
];

export const FIXTURE_VIEWED = ["src/client/motion.css"];
