// windows can rename a running exe but not delete or overwrite it, so `update` retires the old
// binary aside. a copy still held by an old MCP server can't be removed, so retire to a fresh name.

import { existsSync, readdirSync, renameSync, rmSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const retiredPrefix = (target: string) => `.${basename(target)}.old`;

export function isRetiredLeftover(name: string, target: string): boolean {
  return name.startsWith(retiredPrefix(target));
}

// the plain name when free, else a unique timestamped one
export function retiredName(target: string, plainTaken: boolean, now = Date.now()): string {
  return plainTaken ? `${retiredPrefix(target)}-${now}` : retiredPrefix(target);
}

// best effort: locked leftovers stay until the process holding them exits
function removeStaleRetired(target: string): void {
  const dir = dirname(target);
  for (const name of readdirSync(dir).filter((entry) => isRetiredLeftover(entry, target))) {
    try { rmSync(join(dir, name), { force: true }); } catch { /* still in use */ }
  }
}

export function retireBinary(target: string): void {
  removeStaleRetired(target);
  const plainTaken = existsSync(join(dirname(target), retiredName(target, false)));
  renameSync(target, join(dirname(target), retiredName(target, plainTaken)));
}
