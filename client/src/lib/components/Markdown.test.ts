import { render } from "@testing-library/svelte";
import { describe, it, expect } from "vitest";
import Markdown from "./Markdown.svelte";

describe("Markdown", () => {
  it("renders chat-style markdown with github line breaks", () => {
    const { container } = render(Markdown, { text: "**done** with `build.cs`\nnext line" });
    expect(container.querySelector("strong")).toHaveTextContent("done");
    expect(container.querySelector("code")).toHaveTextContent("build.cs");
    expect(container.querySelector("br")).not.toBeNull();
  });

  it("sanitizes raw html", () => {
    const { container } = render(Markdown, { text: '<img src=x onerror="alert(1)"><script>alert(1)</script>hi' });
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")?.getAttribute("onerror")).toBeNull();
  });
});
