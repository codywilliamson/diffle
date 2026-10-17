import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BINDINGS } from "../client/src/lib/keymap/keymap";
import { renderKeymapDocs, syncReadme } from "../scripts/keymap-docs";

const readme = readFileSync(join(import.meta.dir, "..", "README.md"), "utf8").replace(/\r\n/g, "\n");

describe("keyboard docs", () => {
  test("README's keyboard section matches the keymap table (run: bun scripts/keymap-docs.ts)", () => {
    expect(syncReadme(readme)).toBe(readme);
  });

  test("lists every visible binding and no reserved one", () => {
    const docs = renderKeymapDocs(3);
    for (const b of BINDINGS) {
      const row = `| \`${b.keys}\` |`;
      expect(docs.includes(row), b.keys).toBe(!b.reserved);
    }
  });
});
