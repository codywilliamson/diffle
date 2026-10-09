// a public declaration removed and re-added verbatim inside one moved block was moved, not
// removed — drop both flags so a refactor doesn't read as a breaking api change.

import type { ChangeFlag, FileAnalysis, MovedBlock } from "../../types";

const REMOVED = "removed ";
const ADDED = "added ";

const labelOf = (flag: ChangeFlag, prefix: string): string => flag.reason.slice(prefix.length);

const covers = (side: MovedBlock["from"], file: string, line: number): boolean =>
  side.file === file && line >= side.start && line <= side.end;

interface Located {
  flag: ChangeFlag;
  file: string;
  line: number;
  label: string;
}

function collect(files: FileAnalysis[], kind: ChangeFlag["kind"], prefix: string): Located[] {
  return files.flatMap((f) =>
    f.flags.flatMap((flag) => (flag.kind === kind && typeof flag.line === "number" ? [{ flag, file: f.path, line: flag.line, label: labelOf(flag, prefix) }] : [])),
  );
}

export function dropMovedApiFlags(files: FileAnalysis[], moved: MovedBlock[]): FileAnalysis[] {
  if (!moved.length) return files;
  const removed = collect(files, "public-api-removed", REMOVED);
  const added = collect(files, "public-api-added", ADDED);
  const cancelled = new Set<ChangeFlag>();
  for (const r of removed) {
    const match = added.find(
      (a) => !cancelled.has(a.flag) && a.label === r.label && moved.some((b) => covers(b.from, r.file, r.line) && covers(b.to, a.file, a.line)),
    );
    if (!match) continue;
    cancelled.add(r.flag);
    cancelled.add(match.flag);
  }
  return files.map((f) => ({ ...f, flags: f.flags.filter((flag) => !cancelled.has(flag)) }));
}
