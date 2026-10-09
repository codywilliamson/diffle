import { describe, it, expect, afterEach } from "vitest";
import { currentFile } from "./currentFile";

const PATHS = ["a.ts", "b.ts", "c.ts"];

// mount a pane plus one section per path, each stubbed to the given top/bottom.
function layout(pane: { top: number; bottom: number }, sections: Record<string, [number, number]>): void {
  const root = document.createElement("section");
  root.dataset.diffPane = "";
  root.getBoundingClientRect = () => ({ ...pane, height: pane.bottom - pane.top }) as DOMRect;
  const list = document.createElement("div");
  list.dataset.fileSections = "";
  for (const [path, [top, bottom]] of Object.entries(sections)) list.append(section(path, top, bottom));
  root.append(list);
  document.body.append(root);
}

function section(path: string, top: number, bottom: number): HTMLElement {
  const el = document.createElement("section");
  el.dataset.filePath = path;
  el.getBoundingClientRect = () => ({ top, bottom }) as DOMRect;
  return el;
}

afterEach(() => document.body.replaceChildren());

describe("currentFile", () => {
  it("falls back to the selection without a laid-out pane", () => {
    expect(currentFile(PATHS, "b.ts")).toBe("b.ts");
    expect(currentFile(PATHS, null)).toBe("a.ts");
  });

  it("keeps the selected file while it's still on screen", () => {
    layout({ top: 0, bottom: 500 }, { "a.ts": [-900, -100], "b.ts": [-100, 300], "c.ts": [300, 600] });
    expect(currentFile(PATHS, "c.ts")).toBe("c.ts");
  });

  it("uses the section at the pane top once the reviewer scrolls away", () => {
    layout({ top: 0, bottom: 500 }, { "a.ts": [-2000, -1000], "b.ts": [-1000, 800], "c.ts": [800, 1200] });
    expect(currentFile(PATHS, "a.ts")).toBe("b.ts");
    expect(currentFile(PATHS, null)).toBe("b.ts");
  });

  it("tolerates a section scrolled to a fractional offset below the pane top", () => {
    layout({ top: 0, bottom: 500 }, { "a.ts": [-800, 0.5], "b.ts": [0.5, 400], "c.ts": [400, 900] });
    expect(currentFile(PATHS, null)).toBe("b.ts");
  });

  it("tells apart paths whose anchor ids collide", () => {
    const paths = ["a/b.ts", "a-b.ts"];
    layout({ top: 0, bottom: 500 }, { "a/b.ts": [-900, -100], "a-b.ts": [-100, 600] });
    expect(currentFile(paths, null)).toBe("a-b.ts");
    expect(currentFile(paths, "a/b.ts")).toBe("a-b.ts");
  });

  it("ignores data-file-path markers nested inside a section's rendered content", () => {
    layout({ top: 0, bottom: 500 }, { "a.ts": [-900, 400], "b.ts": [400, 900] });
    document.querySelector("[data-file-path='b.ts']")?.append(section("b.ts", -500, -400));
    expect(currentFile(["a.ts", "b.ts"], null)).toBe("a.ts");
  });

  it("ignores a nested copy of the section list inside rendered content", () => {
    layout({ top: 0, bottom: 500 }, { "a.ts": [-900, 400], "b.ts": [400, 900] });
    const fake = document.createElement("div");
    fake.dataset.fileSections = "";
    fake.append(section("b.ts", -500, -400));
    document.querySelector("[data-file-path='b.ts']")?.append(fake);
    expect(currentFile(["a.ts", "b.ts"], null)).toBe("a.ts");
  });
});
