import { describe, it, expect } from "bun:test";
import { assetName, detectPackageManager, managerCommand, parseChecksum, platformTarget } from "../src/core/updateTarget";

describe("platformTarget / assetName", () => {
  it("maps platform + arch to a release slug", () => {
    expect(platformTarget("win32", "x64")).toBe("windows-x64");
    expect(platformTarget("darwin", "arm64")).toBe("darwin-arm64");
    expect(platformTarget("linux", "x64")).toBe("linux-x64");
  });

  it("adds .exe only for windows targets", () => {
    expect(assetName("windows-arm64")).toBe("diffle-windows-arm64.exe");
    expect(assetName("linux-x64")).toBe("diffle-linux-x64");
  });
});

describe("parseChecksum", () => {
  const manifest = [
    "aa".repeat(32) + "  diffle-linux-x64",
    "bb".repeat(32) + " *diffle-windows-x64.exe",
  ].join("\n");

  it("finds the sha for a named asset (with or without a binary marker)", () => {
    expect(parseChecksum(manifest, "diffle-linux-x64")).toBe("aa".repeat(32));
    expect(parseChecksum(manifest, "diffle-windows-x64.exe")).toBe("bb".repeat(32));
  });

  it("returns null for an unlisted asset", () => {
    expect(parseChecksum(manifest, "diffle-darwin-arm64")).toBeNull();
  });
});

describe("detectPackageManager", () => {
  it("recognizes manager-owned install paths", () => {
    expect(detectPackageManager("/opt/homebrew/Cellar/diffle/0.16.0/bin/diffle")).toBe("homebrew");
    expect(detectPackageManager("C:/Users/x/scoop/apps/diffle/current/diffle.exe")).toBe("scoop");
    expect(managerCommand("homebrew")).toBe("brew upgrade diffle");
  });

  it("returns null for a standalone user install we may replace", () => {
    expect(detectPackageManager("C:/Users/x/.diffle/bin/diffle.exe")).toBeNull();
    expect(detectPackageManager("/home/x/.diffle/bin/diffle")).toBeNull();
  });
});
