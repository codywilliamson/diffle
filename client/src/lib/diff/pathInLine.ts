// gf: find a file path in a line of code that names a file in the diff. pure.
// handles "src/a.ts", "./a", "../lib/a.ts:42", and extensionless imports ("./store" -> store.ts).

const TOKEN = /([A-Za-z0-9_@.+\-/\\]+)(?::(\d+))?/g;
const TRAILING_PUNCTUATION = /[.,;]+$/;

export interface PathHit {
  path: string;
  line: number | null;
}

function normalize(path: string): string {
  const out: string[] = [];
  for (const part of path.replaceAll("\\", "/").split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return out.join("/");
}

const dirOf = (path: string): string => (path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "");
const withoutExtension = (path: string): string => path.replace(/\.[^./]+$/, "");

function matches(file: string, candidate: string): boolean {
  return file === candidate || withoutExtension(file) === candidate || file.startsWith(`${candidate}/index.`);
}

// the diff files a token can mean: relative to the current file first, then from the repo root,
// then as a path suffix (a bare name only when it is unambiguous)
function resolveToken(token: string, from: string, files: string[]): string | null {
  const cleaned = token.replace(TRAILING_PUNCTUATION, "");
  if (cleaned === "" || !/[./]/.test(cleaned)) return null;
  const relative = normalize(`${dirOf(from)}/${cleaned}`);
  const root = normalize(cleaned);
  const exact = files.find((f) => matches(f, relative)) ?? files.find((f) => matches(f, root));
  if (exact) return exact;
  const tails = files.filter((f) => f.endsWith(`/${root}`) || withoutExtension(f).endsWith(`/${root}`));
  return tails.length === 1 ? tails[0]! : null;
}

export function pathInLine(text: string, from: string, files: string[]): PathHit | null {
  for (const match of text.matchAll(TOKEN)) {
    const path = resolveToken(match[1]!, from, files);
    if (path) return { path, line: match[2] ? Number(match[2]) : null };
  }
  return null;
}
