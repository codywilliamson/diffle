// unix PATH swap for the install-dir migration. the 0.28.x installer wrote one marker block
// (MARKER_START..MARKER_END) into the rc file it chose, plus an optional .bash_profile shim block.
// only those exact blocks are rewritten to the nittle block; nothing else in any profile is
// touched. the file is copied to <rc>.nittle.bak-<stamp> first, as the installer does.

import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PRODUCT } from "../product";

export const markers = (name: string) => ({ start: `# >>> ${name} >>>`, end: `# <<< ${name} <<<` });

const LEGACY = markers(PRODUCT.legacyName);
const CURRENT = markers(PRODUCT.name);

export interface RcSwapOptions {
  home: string;
  env: NodeJS.ProcessEnv;
  legacyDir: string;
  newDir: string;
  now?: Date;
  log: (line: string) => void;
}

// every file the installer may have written a block into
export function rcCandidates(home: string, env: NodeJS.ProcessEnv): string[] {
  const config = env.XDG_CONFIG_HOME || join(home, ".config");
  return [...new Set([join(env.ZDOTDIR || home, ".zshrc"), join(home, ".bashrc"), join(home, ".bash_profile"), join(home, ".profile"), join(config, "fish", "config.fish")])];
}

const pad = (n: number) => String(n).padStart(2, "0");
const stamp = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

// the lines with each legacy block swapped for the nittle block (or dropped when a nittle block
// is already there, so the entry is never duplicated). null when there is no complete legacy block.
export function swapBlocks(lines: string[], legacyDir: string, newDir: string): string[] | null {
  const hasCurrent = lines.includes(CURRENT.start);
  const out: string[] = [];
  let swapped = false;
  for (let i = 0; i < lines.length; i++) {
    const end = lines[i] === LEGACY.start ? lines.indexOf(LEGACY.end, i + 1) : -1;
    if (end < 0) {
      out.push(lines[i]!);
      continue;
    }
    swapped = true;
    if (hasCurrent) {
      // drop the block plus the one blank line the installer inserted above it
      if (out.at(-1) === "") out.pop();
    } else {
      const body = lines.slice(i + 1, end).map((line) => line.replaceAll(legacyDir, newDir));
      out.push(CURRENT.start, ...body, CURRENT.end);
    }
    i = end;
  }
  return swapped ? out : null;
}

// returns the rc files that were rewritten
export function swapRcBlocks(opts: RcSwapOptions): string[] {
  const changed: string[] = [];
  for (const rc of rcCandidates(opts.home, opts.env)) {
    if (!existsSync(rc)) continue;
    const original = readFileSync(rc, "utf8");
    if (!original.includes(LEGACY.start)) continue;
    const next = swapBlocks(original.split("\n"), opts.legacyDir, opts.newDir);
    if (!next) continue;
    const backup = `${rc}.${PRODUCT.name}.bak-${stamp(opts.now ?? new Date())}`;
    copyFileSync(rc, backup);
    writeFileSync(rc, next.join("\n"));
    opts.log(`PATH: rewrote the ${PRODUCT.legacyName} block in ${rc} to ${PRODUCT.name} (backup: ${backup})`);
    changed.push(rc);
  }
  return changed;
}
