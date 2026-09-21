// renders every take as a standalone short (out/<id>.mp4), the stitched long reel
// (out/walkthrough.mp4), and a punchy README gif from the comment take (out/walkthrough.gif).
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const demos = join(here, "..");
const ids = readdirSync(join(demos, "public", "footage"))
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(".json", ""));

const remotion = (args) =>
  execFileSync("npx", ["remotion", ...args], { cwd: demos, stdio: "inherit", shell: true });

for (const id of ids) {
  remotion(["render", "src/index.ts", `take-${id}`, `out/${id}.mp4`, "--crf", "23", "--log=error"]);
}
remotion(["render", "src/index.ts", "LongReel", "out/walkthrough.mp4", "--crf", "26", "--log=error"]);
remotion(["render", "src/index.ts", "take-comment", "out/walkthrough.gif", "--codec", "gif", "--scale", "0.4", "--every-nth-frame", "5", "--log=error"]);

console.log("\nrendered shorts + long reel + readme gif in out/");
