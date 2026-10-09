import { describe, expect, test } from "bun:test";
import { dropMovedApiFlags } from "../src/core/analysis/movedApi";
import type { MovedBlock } from "../src/types";
import { analysis, flag } from "./fixtures/analysis/fileAnalysis";

const SIG = "public method `CalculateTax(decimal subtotal, string region)`";
const at = (kind: "public-api-removed" | "public-api-added", sig: string, line: number | null) => ({
  ...flag(kind, `${kind === "public-api-removed" ? "removed" : "added"} ${sig}`),
  line,
});
const block = (fromFile: string, from: [number, number], toFile: string, to: [number, number]): MovedBlock => ({
  from: { file: fromFile, start: from[0], end: from[1] },
  to: { file: toFile, start: to[0], end: to[1] },
  edited: false,
});

describe("dropMovedApiFlags", () => {
  test("a declaration inside a moved block is a move", () => {
    const [from, to] = dropMovedApiFlags(
      [
        analysis("OrderService.cs", { flags: [at("public-api-removed", SIG, 12), flag("hotspot")] }),
        analysis("Pricing.cs", { flags: [at("public-api-added", SIG, 40)] }),
      ],
      [block("OrderService.cs", [10, 20], "Pricing.cs", [38, 48])],
    );
    expect(from!.flags.map((f) => f.kind)).toEqual(["hotspot"]);
    expect(to!.flags).toEqual([]);
  });

  test("same label without a covering block is not cancelled", () => {
    const files = [
      analysis("A.cs", { flags: [at("public-api-removed", SIG, 12)] }),
      analysis("B.cs", { flags: [at("public-api-added", SIG, 40)] }),
    ];
    expect(dropMovedApiFlags(files, []).flatMap((f) => f.flags).length).toBe(2);
    const elsewhere = [block("A.cs", [1, 5], "B.cs", [1, 5])];
    expect(dropMovedApiFlags(files, elsewhere).flatMap((f) => f.flags).length).toBe(2);
    const wrongFile = [block("A.cs", [10, 20], "C.cs", [38, 48])];
    expect(dropMovedApiFlags(files, wrongFile).flatMap((f) => f.flags).length).toBe(2);
  });

  test("unrelated types sharing a label are matched through their own blocks", () => {
    const sig = "public method `ToString()`";
    const out = dropMovedApiFlags(
      [
        analysis("A.cs", { flags: [at("public-api-removed", sig, 5)] }),
        analysis("B.cs", { flags: [at("public-api-removed", sig, 5)] }),
        analysis("C.cs", { flags: [at("public-api-added", sig, 9)] }),
      ],
      [block("B.cs", [1, 8], "C.cs", [7, 14])],
    );
    expect(out.map((f) => f.flags.length)).toEqual([1, 0, 0]);
  });

  test("flags without a line are never cancelled", () => {
    const files = [
      analysis("A.cs", { flags: [at("public-api-removed", SIG, null)] }),
      analysis("B.cs", { flags: [at("public-api-added", SIG, null)] }),
    ];
    expect(dropMovedApiFlags(files, [block("A.cs", [1, 99], "B.cs", [1, 99])]).flatMap((f) => f.flags).length).toBe(2);
  });

  test("a real removal and an unrelated addition both stay", () => {
    const out = dropMovedApiFlags(
      [
        analysis("A.cs", { flags: [at("public-api-removed", SIG, 3)] }),
        analysis("B.cs", { flags: [at("public-api-added", "public method `Other()`", 3)] }),
      ],
      [block("A.cs", [1, 9], "B.cs", [1, 9])],
    );
    expect(out.flatMap((f) => f.flags).length).toBe(2);
  });
});
