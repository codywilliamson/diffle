import { describe, expect, test } from "bun:test";
import type { DiffFile, DiffResult } from "../src/types";
import { buildRadarDrafts } from "../src/radar/units";

function file(path: string, removed: string, added: string, extra: Partial<DiffFile> = {}): DiffFile {
  return { path, oldPath: null, changeType: "modified", additions: 1, deletions: 1,
    hunks: [{ header: "@@ -4,1 +4,1 @@", section: "function changed()", lines: [
      { type: "deletion", oldLine: 4, newLine: null, content: removed },
      { type: "addition", oldLine: null, newLine: 4, content: added },
    ] }], ...extra };
}

const diff = (...files: DiffFile[]): DiffResult => ({ ref: "test", files });

describe("Radar review units", () => {
  test("uses deterministic boundaries as a floor and preserves a safe packet", () => {
    const [draft] = buildRadarDrafts(diff(file("src/auth/session.ts", "return false", "return authorize(user)")), "jev");
    expect(draft!.unit.lane).toBe("boundary");
    expect(draft!.unit.chip).toContain("boundary");
    expect(draft!.unit.title).toContain("function changed()");
    expect(draft!.packet.unit.patch).toContain("authorize(user)");
  });

  test("redacts and withholds secret-shaped content", () => {
    const secret = "sk-or-v1-abcdefghijklmnopqrstuvwxyz123456";
    const [draft] = buildRadarDrafts(diff(file("src/config.ts", "key = ''", `key = '${secret}'`)), "jev");
    expect(draft!.unit.lane).toBe("blocker");
    expect(draft!.unit.remote).toBe(false);
    expect(draft!.unit.redaction).toBe(true);
    expect(draft!.unit.sufficiency).toBe("insufficient");
    expect(draft!.packet.unit.patch).not.toContain(secret);
    expect(draft!.packet.unit.patch).toContain("<redacted:openrouter-key>");
  });

  test("withholds common provider tokens and unquoted secret assignments", () => {
    const slackToken = ["xoxb", "1234567890", "abcdefghijklmnop"].join("-");
    for (const value of ["sk_live_abcdefghijklmnopqrstuv", "sk-proj-abcdefghijklmnopqrstuvwxyz", slackToken, "token=abcdefghijklmnopqrstuvwxyz123456"]) {
      const [draft] = buildRadarDrafts(diff(file("src/config.ts", "old", value)), "jev");
      expect(draft!.unit.lane).toBe("blocker");
      expect(draft!.packet.unit.patch).not.toContain(value);
    }
  });

  test("exact conflict markers outrank ordinary semantic review", () => {
    const [draft] = buildRadarDrafts(diff(file("src/a.ts", "old", "<<<<<<< ours")), "jev");
    expect(draft!.unit.lane).toBe("verified");
    expect(draft!.unit.provenance.join(" ")).toContain("conflict marker");
  });

  test("keeps binary and pure-rename changes as local metadata units", () => {
    const binary: DiffFile = { path: "asset.png", oldPath: null, changeType: "modified", additions: 0, deletions: 0, binary: true, hunks: [] };
    const rename: DiffFile = { path: "new.ts", oldPath: "old.ts", changeType: "renamed", additions: 0, deletions: 0, hunks: [] };
    const units = buildRadarDrafts(diff(binary, rename), "jev").map((draft) => draft.unit);
    expect(units).toHaveLength(2);
    expect(units.every((unit) => unit.lane === "boundary" && !unit.remote)).toBe(true);
  });

  test("sends the matching function-context island while preserving the display hunk anchor", () => {
    const display = diff(file("src/a.ts", "return false", "return true"));
    const context = diff({ ...display.files[0]!, hunks: [{ header: "@@ -1,9 +1,9 @@", section: "function changed()", lines: [
      { type: "context", oldLine: 1, newLine: 1, content: "const outside = true;" },
      ...display.files[0]!.hunks[0]!.lines,
      { type: "context", oldLine: 5, newLine: 5, content: "return outside;" },
    ] }] });
    const [draft] = buildRadarDrafts(display, "jev", context);
    expect(draft!.unit.line).toBe(4);
    expect(draft!.unit.context.lines).toBe(4);
    expect(draft!.packet.unit.patch).toContain("const outside = true");
  });

  test("labels oversized non-secret units as context blockers", () => {
    const [draft] = buildRadarDrafts(diff(file("src/large.ts", "old", "x".repeat(25_000))), "jev");
    expect(draft!.unit.lane).toBe("blocker");
    expect(draft!.unit.chip).toBe("context over cap");
    expect(draft!.unit.summary).toContain("packet cap");
  });
});
