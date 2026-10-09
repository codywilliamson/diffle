import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { analyzeDiff } from "../src/core/analysis/analyzeDiff";
import { file, hunk } from "./fixtures/analysis/diffBuilders";

const body = ["function total(a, b) {", "  const sum = a + b;", "  log(sum);", "  save(sum);", "  return sum;", "}"];
const mark = (sign: string, lines: string[]) => lines.map((l) => `${sign}${l}`);

describe("edited moved blocks", () => {
  test("only the edited pair stays effective; verbatim moved lines are noise", () => {
    const cwd = mkdtempSync(join(tmpdir(), "moved-edit-"));
    try {
      const edited = body.map((l) => (l.includes("log(") ? "  log(sum, true);" : l));
      const diff = {
        files: [file("a.ts", [hunk(1, 1, mark("-", body))]), file("b.ts", [hunk(1, 1, mark("+", edited))])],
      };
      const card = analyzeDiff(diff as never, { cwd, newRef: null, churnBase: null });
      expect(card.moved[0]?.edited).toBe(true);
      const a = card.files.find((f) => f.path === "a.ts")!;
      const b = card.files.find((f) => f.path === "b.ts")!;
      expect(a.effectiveLines).toBe(1);
      expect(b.effectiveLines).toBe(1);
      expect(a.noiseLines + b.noiseLines).toBe(10);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
