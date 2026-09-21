import { describe, it, expect } from "vitest";
import { changeBadge, langFor, isMarkdown, resolveRepoPath, relativeTime } from "./format";

describe("format helpers", () => {
  it("maps change types to badges", () => {
    expect(changeBadge("added").letter).toBe("A");
    expect(changeBadge("deleted").letter).toBe("D");
  });

  it("maps extensions to highlight.js languages", () => {
    expect(langFor("a.ts")).toBe("typescript");
    expect(langFor("a.py")).toBe("python");
    expect(langFor("a.unknownext")).toBeNull();
  });

  it("detects markdown files", () => {
    expect(isMarkdown("readme.md")).toBe(true);
    expect(isMarkdown("a.ts")).toBe(false);
  });

  it("resolves repo-relative link/image targets", () => {
    expect(resolveRepoPath("docs/guide.md", "../img/a.png")).toBe("img/a.png");
    expect(resolveRepoPath("docs/guide.md", "./b.png")).toBe("docs/b.png");
    expect(resolveRepoPath("docs/guide.md", "/root.png")).toBe("root.png");
  });

  it("formats a relative time", () => {
    const anHourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
    expect(relativeTime(anHourAgo)).toBe("1h ago");
  });
});
