import { describe, expect, it } from "bun:test";
import { isOwnInstall, listMcpProcesses, parseUnixPs, parseWindowsCim } from "../src/core/mcpProcesses";
import { stopMcpServers } from "../src/utils/mcpCli";

describe("parseUnixPs retired names", () => {
  it("finds loupe servers by exact name and ignores lookalikes", () => {
    const output = "  1 /h/.loupe/bin/loupe mcp serve\n  2 /h/loupe-helper mcp serve\n";
    expect(parseUnixPs(output).map((proc) => proc.pid)).toEqual([1]);
  });
});

describe("parseUnixPs", () => {
  it("keeps only product binaries running mcp serve, including paths with spaces", () => {
    const output = [
      "  101 nittle mcp serve",
      "  102 /Users/me/Library/Application Support/Claude/Claude Extensions/nittle/server/nittle mcp serve",
      "  103 diffle mcp serve",
      "  104 bun src/index.ts mcp serve",
      "  105 nittle sessions",
      "  106 /usr/bin/other mcp serve",
      "",
    ].join("\n");
    expect(parseUnixPs(output)).toEqual([
      { pid: 101, path: "nittle" },
      { pid: 102, path: "/Users/me/Library/Application Support/Claude/Claude Extensions/nittle/server/nittle" },
      { pid: 103, path: "diffle" },
    ]);
  });
});

describe("parseWindowsCim", () => {
  const row = (pid: number, commandLine: string | null) => ({ ProcessId: pid, ExecutablePath: "C:\\Users\\me\\.nittle\\bin\\nittle.exe", CommandLine: commandLine });

  it("accepts a bare object for a single process", () => {
    expect(parseWindowsCim(JSON.stringify(row(7, "nittle mcp serve")))).toEqual([{ pid: 7, path: "C:\\Users\\me\\.nittle\\bin\\nittle.exe" }]);
  });

  it("filters out non-serve commands and rows without a command line", () => {
    const output = JSON.stringify([row(1, "\"C:\\x\\nittle.exe\" mcp serve"), row(2, "nittle update"), row(3, null)]);
    expect(parseWindowsCim(output).map((proc) => proc.pid)).toEqual([1]);
  });

  it("returns nothing for empty output", () => {
    expect(parseWindowsCim("")).toEqual([]);
  });
});

describe("isOwnInstall", () => {
  it("treats a bare command name as the installed binary", () => {
    expect(isOwnInstall({ pid: 1, path: "nittle" }, "/opt/nittle/bin/nittle")).toBe(true);
  });

  it("matches absolute paths against the running binary only", () => {
    expect(isOwnInstall({ pid: 1, path: "/opt/nittle/bin/nittle" }, "/opt/nittle/bin/nittle")).toBe(true);
    expect(isOwnInstall({ pid: 1, path: "/claude/extensions/nittle/server/nittle" }, "/opt/nittle/bin/nittle")).toBe(false);
  });
});

describe("stopMcpServers", () => {
  it("returns the servers whose stop failed", () => {
    const servers = [{ pid: 1, path: "nittle" }, { pid: 2, path: "nittle" }];
    expect(stopMcpServers(servers, (pid) => pid === 1)).toEqual([{ pid: 2, path: "nittle" }]);
  });
});

describe("listMcpProcesses", () => {
  // cold Windows CIM queries can exceed the suite's 10s default.
  it("reads the real process table and never lists itself", () => {
    expect(listMcpProcesses().some((proc) => proc.pid === process.pid)).toBe(false);
  }, 30_000);
});
