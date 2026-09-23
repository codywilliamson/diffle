import { describe, it, expect } from "vitest";
import { languageFor } from "./languages";

describe("languageFor", () => {
  it("uses shiki ids and aliases straight from the extension", () => {
    expect(languageFor("src/a.ts")).toBe("ts");
    expect(languageFor("App.svelte")).toBe("svelte");
    expect(languageFor("App.vue")).toBe("vue");
    expect(languageFor("pages/index.astro")).toBe("astro");
    expect(languageFor("Cargo.toml")).toBe("toml");
    expect(languageFor("init.LUA")).toBe("lua");
  });

  it("maps extensions shiki has no alias for", () => {
    expect(languageFor("icon.svg")).toBe("xml");
    expect(languageFor("lib.h")).toBe("c");
    expect(languageFor("Mod.psm1")).toBe("powershell");
    expect(languageFor("lib/app.ex")).toBe("elixir");
    expect(languageFor("App.csproj")).toBe("xml");
  });

  it("recognizes files by name", () => {
    expect(languageFor("Dockerfile")).toBe("docker");
    expect(languageFor("docker/Dockerfile.dev")).toBe("docker");
    expect(languageFor("Makefile")).toBe("make");
    expect(languageFor("CMakeLists.txt")).toBe("cmake");
    expect(languageFor(".env")).toBe("dotenv");
    expect(languageFor(".env.local")).toBe("dotenv");
  });

  it("returns null without a grammar", () => {
    expect(languageFor("a.unknownext")).toBeNull();
    expect(languageFor("LICENSE")).toBeNull();
    expect(languageFor(".bashrc")).toBeNull();
  });
});
