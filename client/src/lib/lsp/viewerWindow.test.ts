import { describe, expect, it } from "vitest";
import { windowAround } from "./viewerWindow";

const file = (n: number): string => Array.from({ length: n }, (_, i) => `line ${i + 1}`).join("\n") + "\n";

describe("windowAround", () => {
  it("shows a small file whole, without a phantom last line", () => {
    const view = windowAround(file(5), 3);
    expect([view.first, view.last, view.total, view.lines.length]).toEqual([1, 5, 5, 5]);
  });

  it("centers the window on the target in a big file", () => {
    const view = windowAround(file(100), 50, 20);
    expect([view.first, view.last]).toEqual([40, 59]);
    expect(view.lines).toContain("line 50");
  });

  it("clamps at both ends", () => {
    expect(windowAround(file(100), 2, 20)).toMatchObject({ first: 1, last: 20 });
    expect(windowAround(file(100), 99, 20)).toMatchObject({ first: 81, last: 100 });
  });

  it("copes with crlf and an empty file", () => {
    expect(windowAround("a\r\nb\r\n", 1).lines).toEqual(["a", "b"]);
    expect(windowAround("", 1)).toMatchObject({ total: 1, lines: [""] });
  });
});
