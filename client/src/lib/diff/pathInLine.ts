// gf: find a file path in a line of code that names a file in the diff. pure.
// handles "src/a.ts", "./a", "../lib/a.ts:42", and extensionless imports ("./store" -> store.ts).
// a token that fits more than one file is reported as ambiguous rather than guessed.

const TOKEN = /([A-Za-z0-9_@.+\-/\\]+)(?::(\d+))?/g;
const TRAILING_PUNCTUATION = /[.,;]+$/;
const EXPLICITLY_RELATIVE = /^\.{1,2}[/\\]/;
const DOT_SEGMENT = /^\.*$/;

export interface PathHit {
  path: string;
  line: number | null;
}

export interface AmbiguousPath {
  ambiguous: string[];
  query: string; // what to pre-fill the file picker with
}

export type PathLookup = PathHit | AmbiguousPath;

// "a/../b" -> "b". null when it climbs above the root.
function normalize(path: string): string | null {
  const out: string[] = [];
  for (const part of path.replaceAll("\\", "/").split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (out.length === 0) return null;
      out.pop();
    } else out.push(part);
  }
  return out.join("/");
}

const dirOf = (path: string): string => (path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "");
const withoutExtension = (path: string): string => path.replace(/\.[^./]+$/, "");
const baseOf = (path: string): string => withoutExtension(path.slice(path.lastIndexOf("/") + 1));

function matches(file: string, candidate: string): boolean {
  return file === candidate || withoutExtension(file) === candidate || file.startsWith(`${candidate}/index.`);
}

// the files a normalized path can mean: an exact path wins outright, else every extensionless or
// directory-index match
function matching(files: string[], candidate: string | null): string[] {
  if (candidate === null || candidate === "") return [];
  const exact = files.filter((f) => f === candidate);
  return exact.length > 0 ? exact : files.filter((f) => matches(f, candidate));
}

function suffixMatching(files: string[], root: string): string[] {
  return files.filter((f) => f.endsWith(`/${root}`) || withoutExtension(f).endsWith(`/${root}`));
}

// relative to the current file first, then from the repo root, then as a path suffix. an explicit
// ./ or ../ only ever means relative to the current file.
function candidatesFor(token: string, from: string, files: string[]): string[] {
  const relative = matching(files, normalize(`${dirOf(from)}/${token}`));
  if (relative.length > 0 || EXPLICITLY_RELATIVE.test(token)) return relative;
  const root = normalize(token);
  if (root === null || root === "") return [];
  const fromRoot = matching(files, root);
  return fromRoot.length > 0 ? fromRoot : suffixMatching(files, root);
}

function lookup(token: string, from: string, files: string[]): string[] {
  const cleaned = token.replace(TRAILING_PUNCTUATION, "");
  // needs a real name in it: not "//", "..", "./" or a lone dot run
  if (cleaned.split(/[\\/]/).every((part) => DOT_SEGMENT.test(part))) return [];
  if (!/[./]/.test(cleaned)) return [];
  return candidatesFor(cleaned, from, files);
}

export function pathInLine(text: string, from: string, files: string[]): PathLookup | null {
  for (const match of text.matchAll(TOKEN)) {
    const found = lookup(match[1]!, from, files);
    if (found.length === 1) return { path: found[0]!, line: match[2] ? Number(match[2]) : null };
    if (found.length > 1) return { ambiguous: found, query: baseOf(match[1]!.replace(TRAILING_PUNCTUATION, "")) };
  }
  return null;
}
