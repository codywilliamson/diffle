// the injectable surface of the install-dir migration (home, platform, executable, env, windows user
// PATH store, process control, logging), so tests run fully in temp dirs.

import { homedir } from "node:os";
import { stopLegacyMcpServers } from "../mcpProcesses";
import { PRODUCT } from "../product";
import { defaultUserPathStore, type UserPathStore } from "./installDirWinPath";

export interface InstallDirDeps {
  home: string;
  platform: NodeJS.Platform;
  execPath: string;
  env: NodeJS.ProcessEnv;
  pathStore: UserPathStore; // windows user PATH
  stopServers: () => unknown;
  log: (line: string) => void;
}

export const TAG = `[${PRODUCT.name}]`;
export const exeName = (name: string, platform: NodeJS.Platform) => (platform === "win32" ? `${name}.exe` : name);
export const fromEnv = (env: NodeJS.ProcessEnv, name: string) => env[PRODUCT.envPrefix + name] ?? env[PRODUCT.legacyEnvPrefix + name];

export function defaultDeps(overrides: Partial<InstallDirDeps>): InstallDirDeps {
  const env = overrides.env ?? process.env;
  return {
    home: homedir(), platform: process.platform, execPath: process.execPath, env,
    pathStore: defaultUserPathStore(env), stopServers: stopLegacyMcpServers, log: (line) => console.error(line),
    ...overrides,
  };
}
