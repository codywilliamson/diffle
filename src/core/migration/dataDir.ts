// moves ~/.diffle (then ~/.loupe, which 0.28.x kept using in place) into ~/.nittle on first run.
// no ~/.nittle yet: one directory rename, atomic. ~/.nittle exists: merge (see dataDirMerge.ts).
// on any failure both dirs stay, the paths left behind are printed, and the next launch retries.
//
// NITTLE_DATA_DIR / DIFFLE_DATA_DIR: when set to somewhere other than the default ~/.nittle, the
// user chose where records live, so the home dirs are not touched behind their back (state.json
// keeps resolving through homeDataDir's fallback). set to ~/.nittle itself it counts as default.

import { copyFileSync, existsSync, renameSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { productEnv } from "../../utils/env";
import { LEGACY_HOME_DATA_DIRS } from "../dataDir";
import { PRODUCT } from "../product";
import { mergeLegacyDir, type MergeOps } from "./dataDirMerge";
import type { MigrationStep } from "./runner";

export interface DataDirOptions {
  home?: string;
  override?: string; // the data-dir env override; defaults to the real env
  ops?: MergeOps; // injectable so tests can fail the Nth copy
  rename?: (from: string, to: string) => void;
  warn?: (message: string) => void;
}

export function createDataDirStep(opts: DataDirOptions = {}): MigrationStep {
  return {
    name: "data-dir",
    run() {
      const home = opts.home ?? homedir();
      const dest = join(home, PRODUCT.dataDir);
      const override = opts.override ?? productEnv("DATA_DIR");
      if (override && resolve(override) !== resolve(dest)) return;

      const ops = opts.ops ?? { copyFile: copyFileSync };
      const rename = opts.rename ?? renameSync;
      const problems: string[] = [];
      const moved: string[] = [];
      for (const name of LEGACY_HOME_DATA_DIRS) {
        const src = join(home, name);
        if (!existsSync(src)) continue;
        if (!existsSync(dest)) {
          try {
            rename(src, dest);
            moved.push(src);
            continue;
          } catch { /* rename refused (locked, cross-device): fall through to the copy merge */ }
        }
        const { leftover } = mergeLegacyDir(src, dest, ops);
        if (leftover.length === 0) moved.push(src);
        else problems.push(...leftover);
      }
      if (problems.length > 0) {
        const message = `could not finish moving old data into ${dest}; nothing was deleted. left behind:\n  ${problems.join("\n  ")}\nit will retry on the next run.`;
        (opts.warn ?? ((m: string) => console.error(m)))(message);
        throw new Error(`${problems.length} item(s) left in the old data dir`);
      }
      return moved.length ? `moved ${moved.join(", ")} -> ${dest}` : undefined;
    },
  };
}

export const dataDirStep = createDataDirStep();
