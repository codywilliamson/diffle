import { describe, expect, it } from "bun:test";
import { isOwnInstall, listMcpProcesses, parseUnixPs, parseWindowsCim } from "../src/core/mcpProcesses";
import { stopMcpServers } from "../src/utils/mcpCli";

describe("parseUnixPs", () => {
  it("keeps only product binaries running mcp serve, including paths with spaces", () => {
    const output = [
      "  101 diffle mcp serve",
      "  102 /Users/me/Library/Application Support/Claude/Claude Extensions/diffle/server/diffle mcp serve",
      "  103 loupe mcp serve",
      "  104 bun src/index.ts mcp serve",
      "  105 diffle sessions",
      "  106 /usr/bin/other mcp serve",
      "",
    ].join("\n");
    expect(parseUnixPs(output)).toEqual([
      { pid: 101, path: "diffle" },
      { pid: 102, path: "/Users/me/Library/Application Support/Claude/Claude Extensions/diffle/server/diffle" },
      { pid: 103, path: "loupe" },
    ]);
  });
});

describe("parseWindowsCim", () => {
  const row = (pid: number, commandLine: string | null) => ({ ProcessId: pid, ExecutablePath: "C:\\Users\\me\\.diffle\\bin\\diffle.exe", CommandLine: commandLine });

  it("accepts a bare object for a single process", () => {
    expect(parseWindowsCim(JSON.stringify(row(7, "diffle mcp serve")))).toEqual([{ pid: 7, path: "C:\\Users\\me\\.diffle\\bin\\diffle.exe" }]);
  });

  it("filters out non-serve commands and rows without a command line", () => {
    const output = JSON.stringify([row(1, "\"C:\\x\\diffle.exe\" mcp serve"), row(2, "diffle update"), row(3, null)]);
    expect(parseWindowsCim(output).map((proc) => proc.pid)).toEqual([1]);
  });

  it("returns nothing for empty output", () => {
    expect(parseWindowsCim("")).toEqual([]);
  });
});

describe("isOwnInstall", () => {
  it("treats a bare command name as the installed binary", () => {
    expect(isOwnInstall({ pid: 1, path: "diffle" }, "/opt/diffle/bin/diffle")).toBe(true);
  });

  it("matches absolute paths against the running binary only", () => {
    expect(isOwnInstall({ pid: 1, path: "/opt/diffle/bin/diffle" }, "/opt/diffle/bin/diffle")).toBe(true);
    expect(isOwnInstall({ pid: 1, path: "/claude/extensions/diffle/server/diffle" }, "/opt/diffle/bin/diffle")).toBe(false);
  });
});

describe("stopMcpServers", () => {
  it("returns the servers whose stop failed", () => {
    const servers = [{ pid: 1, path: "diffle" }, { pid: 2, path: "diffle" }];
    expect(stopMcpServers(servers, (pid) => pid === 1)).toEqual([{ pid: 2, path: "diffle" }]);
  });
});

describe("listMcpProcesses", () => {
  it("reads the real process table and never lists itself", () => {
    expect(listMcpProcesses().some((proc) => proc.pid === process.pid)).toBe(false);
  });
});
