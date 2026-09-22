// shared y/N gate for commands that change something. `--yes` skips it; without a tty there is
// nobody to answer, so the command exits instead of hanging.

import { createInterface } from "node:readline/promises";

export async function confirmProceed(yes: boolean): Promise<boolean> {
  if (yes) return true;
  if (process.stdin.isTTY !== true) {
    console.log("pass --yes to proceed");
    process.exit(1);
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return /^y(es)?$/i.test((await rl.question("Proceed? [y/N] ")).trim());
  } finally {
    rl.close();
  }
}
