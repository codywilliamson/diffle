// which revision holds a diff's old side, recovered from the git args the review was launched with.

import { runGit } from "../utils/git";

const HEAD = "HEAD";

// ["diff", "HEAD"] / ["diff", "--staged"] -> HEAD; "a..b" -> a (blank = HEAD); "a...b" -> merge-base;
// ["diff", base, tip] (commit review) -> base. null when there is no base (browse mode).
export function oldSideRef(diffArgs: string[], cwd: string): string | null {
  const operands = diffArgs.slice(1).filter((arg) => !arg.startsWith("-"));
  if (diffArgs[0] !== "diff") return null;
  if (diffArgs.includes("--staged") || operands.length === 0) return HEAD;
  if (operands.length === 2) return operands[0]!;
  const spec = operands[0]!;
  const threeDot = spec.indexOf("...");
  if (threeDot >= 0) {
    const [from, to] = [spec.slice(0, threeDot) || HEAD, spec.slice(threeDot + 3) || HEAD];
    try {
      return runGit(["merge-base", from, to], cwd).trim();
    } catch {
      return from;
    }
  }
  const twoDot = spec.indexOf("..");
  if (twoDot >= 0) return spec.slice(0, twoDot) || HEAD;
  return spec;
}
