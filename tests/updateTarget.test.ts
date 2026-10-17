import { describe, it, expect } from "bun:test";
import { assetName, detectPackageManager, managerCommand, parseChecksum, platformTarget } from "../src/core/updateTarget";

describe("platformTarget / assetName", () => {
  it("maps platform + arch to a release slug", () => {
    expect(platformTarget("win32", "x64")).toBe("windows-x64");
    expect(platformTarget("darwin", "arm64")).toBe("darwin-arm64");
    expect(platformTarget("linux", "x64")).toBe("linux-x64");
  });

  it("adds .exe only for windows targets", () => {
    expect(assetName("windows-arm64")).toBe("nittle-windows-arm64.exe");
    expect(assetName("linux-x64")).toBe("nittle-linux-x64");
  });
});

describe("parseChecksum", () => {
  const manifest = [
    "aa".repeat(32) + "  nittle-linux-x64",
    "bb".repeat(32) + " *nittle-windows-x64.exe",
  ].join("\n");

  it("finds the sha for a named asset (with or without a binary marker)", () => {
    expect(parseChecksum(manifest, "nittle-linux-x64")).toBe("aa".repeat(32));
    expect(parseChecksum(manifest, "nittle-windows-x64.exe")).toBe("bb".repeat(32));
  });

  it("returns null for an unlisted asset", () => {
    expect(parseChecksum(manifest, "nittle-darwin-arm64")).toBeNull();
  });
});

describe("detectPackageManager", () => {
  it("recognizes manager-owned install paths", () => {
    expect(detectPackageManager("/opt/homebrew/Cellar/nittle/0.16.0/bin/nittle")).toBe("homebrew");
    expect(detectPackageManager("C:/Users/x/scoop/apps/nittle/current/nittle.exe")).toBe("scoop");
    expect(managerCommand("homebrew")).toBe("brew upgrade nittle");
  });

  it("returns null for a standalone user install we may replace", () => {
    expect(detectPackageManager("C:/Users/x/.nittle/bin/nittle.exe")).toBeNull();
    expect(detectPackageManager("/home/x/.nittle/bin/nittle")).toBeNull();
  });
});
