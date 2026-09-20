import type { DiffResult, DiffFile, DiffHunk, DiffLine, ChangeType } from "../types";

// strips a leading a/ or b/ prefix from a git path
function stripPrefix(path: string): string {
  return path.replace(/^[ab]\//, "");
}

// parses the @@ -old +new @@ portion, returning starts and the stripped header
function parseHunkHeader(line: string): { oldStart: number; newStart: number; header: string; section?: string } {
  const match = /^(@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@)(?:\s*(.*))?$/.exec(line);
  if (!match) return { oldStart: 1, newStart: 1, header: line.trim() };
  const section = match[4]?.trim();
  return { oldStart: Number(match[2]), newStart: Number(match[3]), header: match[1] ?? "", ...(section ? { section } : {}) };
}

// derives the new path from the diff --git line (b-side), falling back to the a-side
function pathFromGitLine(line: string): string {
  const match = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
  if (match) return stripPrefix(match[2] ?? match[1] ?? "");
  return "";
}

// collects the lines of a single hunk, advancing line counters
function parseHunk(headerLine: string, body: string[]): DiffHunk {
  const { oldStart, newStart, header, section } = parseHunkHeader(headerLine);
  let oldLine = oldStart;
  let newLine = newStart;
  const lines: DiffLine[] = [];
  for (const raw of body) {
    const marker = raw[0];
    if (marker === undefined) continue; // empty trailing line from split — not diff content
    if (marker === "\\") continue; // "\ No newline at end of file" — not a diff line
    const content = raw.slice(1);
    if (marker === "+") {
      lines.push({ type: "addition", oldLine: null, newLine, content });
      newLine++;
    } else if (marker === "-") {
      lines.push({ type: "deletion", oldLine, newLine: null, content });
      oldLine++;
    } else {
      lines.push({ type: "context", oldLine, newLine, content });
      oldLine++;
      newLine++;
    }
  }
  return { header, ...(section ? { section } : {}), lines };
}

// determines change type and old path from a file section's header lines
function classify(lines: string[]): { changeType: ChangeType; oldPath: string | null } {
  let oldPath: string | null = null;
  for (const line of lines) {
    if (line.startsWith("@@")) break;
    if (line.startsWith("new file mode")) return { changeType: "added", oldPath: null };
    if (line.startsWith("deleted file mode")) return { changeType: "deleted", oldPath: null };
    if (line.startsWith("rename from ")) oldPath = stripPrefix(line.slice("rename from ".length).trim());
    if (line.startsWith("rename to ")) return { changeType: "renamed", oldPath };
  }
  return { changeType: "modified", oldPath: null };
}

// builds a DiffFile from one "diff --git" section
function parseFileSection(section: string[]): DiffFile {
  const path = pathFromGitLine(section[0] ?? "");
  const { changeType, oldPath } = classify(section);
  const binary = section.some((l) => l.startsWith("Binary files") || l.startsWith("GIT binary patch"));

  const hunks: DiffHunk[] = [];
  if (!binary) {
    let current: { header: string; body: string[] } | null = null;
    for (const line of section) {
      if (line.startsWith("@@")) {
        if (current) hunks.push(parseHunk(current.header, current.body));
        current = { header: line, body: [] };
      } else if (current) {
        current.body.push(line);
      }
    }
    if (current) hunks.push(parseHunk(current.header, current.body));
  }

  const all = hunks.flatMap((h) => h.lines);
  const additions = binary ? 0 : all.filter((l) => l.type === "addition").length;
  const deletions = binary ? 0 : all.filter((l) => l.type === "deletion").length;

  return { path, oldPath, changeType, additions, deletions, ...(binary ? { binary: true } : {}), hunks };
}

export function parseDiff(raw: string, ref: string): DiffResult {
  if (!raw.trim()) return { ref, files: [] };

  const lines = raw.split("\n");
  const sections: string[][] = [];
  let current: string[] | null = null;
  for (const line of lines) {
    if (line.startsWith("diff --git ")) {
      if (current) sections.push(current);
      current = [line];
    } else if (current) {
      current.push(line);
    }
  }
  if (current) sections.push(current);

  return { ref, files: sections.map(parseFileSection) };
}
