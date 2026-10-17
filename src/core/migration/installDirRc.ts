// unix PATH swap for the install-dir migration. the 0.28.x installer wrote one marker block
// (MARKER_START..MARKER_END) into the rc file it chose, plus an optional .bash_profile shim block.
// only those exact blocks are rewritten to the nittle block; nothing else in any profile is
// touched. the file is copied to <rc>.nittle.bak-<stamp> first, as the installer does.

import { copyFileSync, existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { PRODUCT } from "../product";
import { samePath } from "../../utils/pathWithin";

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

// the PATH entries a block body adds, as the installer wrote them (posix export or fish_add_path)
const ENTRY_LINES = [/^export PATH="(.*):\$PATH"$/, /^fish_add_path "(.*)"$/];
const entryOf = (line: string): string | undefined => ENTRY_LINES.map((re) => re.exec(line)?.[1]).find((entry) => entry !== undefined);
const entriesOf = (body: string[]) => body.map(entryOf).filter((entry): entry is string => entry !== undefined);

// true when a nittle block in `lines` puts `dir` on PATH (compared by filesystem equivalence)
export function hasNittleBlockFor(lines: string[], dir: string): boolean {
  for (let i = 0; i < lines.length; i++) {
    const end = lines[i] === CURRENT.start ? lines.indexOf(CURRENT.end, i + 1) : -1;
    if (end < 0) continue;
    if (entriesOf(lines.slice(i + 1, end)).some((entry) => samePath(entry, dir))) return true;
    i = end;
  }
  return false;
}

// the lines with each legacy block swapped for the nittle block (or dropped when a nittle block
// already puts newDir on PATH, so the entry is never duplicated). a block is only touched when its
// PATH entry is legacyDir by filesystem equivalence (symlinked homes, macos /var -> /private/var);
// one pointing anywhere else is left alone. null when nothing was rewritten.
export function swapBlocks(lines: string[], legacyDir: string, newDir: string): string[] | null {
  const hasCurrent = lines.includes(CURRENT.start);
  const currentGood = hasNittleBlockFor(lines, newDir);
  const out: string[] = [];
  let swapped = false;
  for (let i = 0; i < lines.length; i++) {
    const end = lines[i] === LEGACY.start ? lines.indexOf(LEGACY.end, i + 1) : -1;
    const body = end < 0 ? [] : lines.slice(i + 1, end);
    const entries = entriesOf(body);
    const ours = end >= 0 && entries.every((entry) => samePath(entry, legacyDir));
    if (!ours || (hasCurrent && entries.length > 0 && !currentGood)) {
      out.push(lines[i]!);
      continue;
    }
    swapped = true;
    if (hasCurrent) {
      // drop the block plus the one blank line the installer inserted above it
      if (out.at(-1) === "") out.pop();
    } else {
      const moved = body.map((line) => { const entry = entryOf(line); return entry === undefined ? line : line.replace(entry, newDir); });
      out.push(CURRENT.start, ...moved, CURRENT.end);
    }
    i = end;
  }
  return swapped ? out : null;
}

// the 0.28.x installer's own backups (<rc>.diffle.bak-<stamp>) are kept, just renamed off the old name
function renameLegacyBackups(rc: string): void {
  const oldPrefix = `${basename(rc)}.${PRODUCT.legacyName}.bak-`;
  for (const name of readdirSync(dirname(rc)).filter((entry) => entry.startsWith(oldPrefix))) {
    const stem = join(dirname(rc), `${basename(rc)}.${PRODUCT.name}.bak-${name.slice(oldPrefix.length)}`);
    // our own backup or an earlier rename may already hold the name (same-second stamp): count up
    let renamed = stem;
    for (let n = 1; existsSync(renamed); n++) renamed = `${stem}-${n}`;
    try { renameSync(join(dirname(rc), name), renamed); } catch { /* keep the old name */ }
  }
}

// true when some rc file carries a nittle PATH block for `dir` (the installer's, or this migration's)
export function hasNittleBlock(home: string, env: NodeJS.ProcessEnv, dir: string): boolean {
  return rcCandidates(home, env).some((rc) => {
    try { return hasNittleBlockFor(readFileSync(rc, "utf8").split("\n"), dir); } catch { return false; }
  });
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
    renameLegacyBackups(rc);
    changed.push(rc);
  }
  return changed;
}
