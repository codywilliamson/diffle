// turn a parsed diff into bounded review units with locally provable evidence and safe packets.

import { createHash } from "node:crypto";
import { extname } from "node:path";
import type { DiffFile, DiffHunk, DiffResult, RadarEvidence, RadarLane, RadarPacket, RadarUnit } from "../types";
import { redactSecrets } from "./redact";

const QUESTION_SET = "radar-q1" as const;
const MAX_PACKET_BYTES = 24_000;
const TEST_PATH = /(^|\/)(?:tests?|__tests__|spec)(\/|\.|$)|\.(?:test|spec)\.[^.]+$/i;
const DOC_PATH = /(^|\/)(?:docs?|examples?)(\/|$)|\.(?:md|mdx|txt)$/i;
const NOISE_PATH = /(^|\/)(?:vendor|dist|build|coverage)(\/|$)|(?:^|\/)(?:bun\.lock|package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/i;
const GENERATED_PATH = /(?:^|\/)(?:generated|gen)(?:\/|$)|\.(?:min\.js|map)$/i;
const CONFLICT = /^(?:<{7}|={7}|>{7})(?:\s|$)/m;

const BOUNDARIES: Array<{ kind: string; label: string; path: RegExp; text: RegExp }> = [
  { kind: "security", label: "security", path: /auth|permission|security|crypto|session|token/i, text: /\b(?:authorize|authenticate|permission|credential|encrypt|decrypt)\b/i },
  { kind: "persistent-state", label: "persisted state", path: /migration|schema|database|store|record/i, text: /\b(?:writeFile(?:Sync)?|rename(?:Sync)?|transaction|commit|rollback|database|localStorage|sessionStorage)\b/i },
  { kind: "process-lifetime", label: "process lifetime", path: /session|process|worker|runner/i, text: /\b(?:spawn|kill|AbortController|process\.exit|unref)\b/i },
  { kind: "public-interface", label: "public interface", path: /types|api|router|mcp|manifest|package\.json/i, text: /\b(?:registerTool|route|schema)\b/i },
  { kind: "deployment", label: "deployment", path: /(^|\/)(?:\.github|deploy|infra|scripts?)(\/|$)/i, text: /\b(?:deploy|release|workflow|permission)\b/i },
];

export interface RadarDraft { unit: RadarUnit; packet: RadarPacket; }

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const marker = (type: string) => type === "addition" ? "+" : type === "deletion" ? "-" : " ";

function patchFor(hunk: DiffHunk): string {
  const section = hunk.section ? ` ${hunk.section}` : "";
  return [`${hunk.header}${section}`, ...hunk.lines.map((line) => marker(line.type) + line.content)].join("\n");
}

function anchorFor(hunk: DiffHunk): { line: number; side: "old" | "new" } {
  const added = hunk.lines.find((line) => line.type === "addition" && line.newLine != null);
  if (added) return { line: added.newLine as number, side: "new" };
  const removed = hunk.lines.find((line) => line.type === "deletion" && line.oldLine != null);
  if (removed) return { line: removed.oldLine as number, side: "old" };
  const context = hunk.lines.find((line) => line.newLine != null);
  return { line: context?.newLine ?? 1, side: "new" };
}

function contextFor(contextDiff: DiffResult, path: string, anchor: { line: number; side: "old" | "new" }): DiffHunk | null {
  const file = contextDiff.files.find((item) => item.path === path);
  return file?.hunks.find((hunk) => hunk.lines.some((line) => (anchor.side === "old" ? line.oldLine : line.newLine) === anchor.line)) ?? null;
}

function language(path: string): string | null {
  const ext = extname(path).slice(1).toLowerCase();
  return ext || null;
}

function changedText(hunk: DiffHunk): string {
  return hunk.lines.filter((line) => line.type !== "context").map((line) => line.content).join("\n");
}

function normalizedSides(hunk: DiffHunk): [string, string] {
  const normalize = (value: string) => value.replace(/\s+/g, "").trim();
  return ["deletion", "addition"].map((type) => hunk.lines.filter((line) => line.type === type).map((line) => normalize(line.content)).join("\n")) as [string, string];
}

function evidenceFor(file: DiffFile, hunk: DiffHunk, secretKinds: string[]): RadarEvidence[] {
  const evidence: RadarEvidence[] = [];
  const text = changedText(hunk);
  if (file.binary) evidence.push({ source: "git", kind: "binary-change", level: "attention", message: "Binary content changed and cannot be inspected as text.", line: null });
  else if (hunk.lines.length === 0) evidence.push({ source: "git", kind: "metadata-change", level: "attention", message: `File metadata changed (${file.changeType}).`, line: null });
  if (secretKinds.length) evidence.push({ source: "secret-scan", kind: secretKinds[0] as string, level: "error", message: "Potential secret was redacted and withheld from transmission.", line: anchorFor(hunk).line });
  if (CONFLICT.test(text)) evidence.push({ source: "git", kind: "conflict-marker", level: "error", message: "Added text contains an unresolved conflict marker.", line: anchorFor(hunk).line });
  for (const boundary of BOUNDARIES) {
    if (boundary.path.test(file.path) || boundary.text.test(text)) evidence.push({ source: "path-rule", kind: boundary.kind, level: "attention", message: `Change intersects the configured ${boundary.label} boundary.`, line: anchorFor(hunk).line });
  }
  const [removed, added] = normalizedSides(hunk);
  if (removed && removed === added) evidence.push({ source: "git", kind: "whitespace-only", level: "info", message: "Changed tokens are identical after whitespace normalization.", line: anchorFor(hunk).line });
  return evidence;
}

function baseLane(path: string, evidence: RadarEvidence[]): RadarLane {
  if (evidence.some((item) => item.source === "secret-scan")) return "blocker";
  if (evidence.some((item) => item.kind === "conflict-marker")) return "verified";
  if (TEST_PATH.test(path)) return "routine";
  if (NOISE_PATH.test(path) || GENERATED_PATH.test(path) || DOC_PATH.test(path)) return "noise";
  if (evidence.some((item) => item.level === "attention")) return "boundary";
  return "routine";
}

function localCopy(path: string, lane: RadarLane, evidence: RadarEvidence[]): { chip: string; summary: string; provenance: string[] } {
  const first = evidence[0];
  if (lane === "blocker") {
    const secret = evidence.some((item) => item.source === "secret-scan");
    return { chip: secret ? "secret redacted" : "context over cap",
      summary: secret ? "This unit was kept local because outbound content matched a secret guard." : "This unit was kept local because its required context exceeds the packet cap.",
      provenance: evidence.map((item) => item.message) };
  }
  if (lane === "verified") return { chip: "git · conflict marker", summary: "An exact local check found an unresolved conflict marker on the changed line.", provenance: evidence.map((item) => item.message) };
  if (lane === "boundary") return { chip: `boundary · ${first?.kind ?? "configured path"}`, summary: first?.message ?? "This change crosses a configured review boundary.", provenance: evidence.map((item) => item.message) };
  if (lane === "noise") {
    const reason = evidence.find((item) => item.kind === "whitespace-only")?.kind
      ?? (DOC_PATH.test(path) ? "documentation" : GENERATED_PATH.test(path) ? "generated file" : NOISE_PATH.test(path) ? "vendor or lockfile" : "low-signal change");
    return { chip: reason, summary: "Deterministic evidence classifies this as a noise candidate; it remains available for review.", provenance: [reason, ...evidence.filter((item) => item.level !== "attention").map((item) => item.message)] };
  }
  return { chip: TEST_PATH.test(path) ? "test change" : "no higher lane", summary: "No exact finding or configured boundary raised this unit above routine review.", provenance: evidence.length ? evidence.map((item) => item.message) : ["no exact diagnostic", "no configured boundary"] };
}

export function buildRadarDrafts(diff: DiffResult, model: string, contextDiff: DiffResult = diff): RadarDraft[] {
  const drafts: RadarDraft[] = [];
  for (const file of diff.files) (file.hunks.length ? file.hunks : [{ header: `@@ ${file.changeType} @@`, lines: [] }]).forEach((hunk, hunkIndex) => {
    const rawPatch = patchFor(hunk);
    const anchor = anchorFor(hunk);
    const contextHunk = contextFor(contextDiff, file.path, anchor) ?? hunk;
    const redacted = redactSecrets(file.path, patchFor(contextHunk));
    const packetBytes = Buffer.byteLength(redacted.text);
    const overCap = packetBytes > MAX_PACKET_BYTES;
    const evidence = evidenceFor(file, hunk, redacted.kinds);
    if (overCap) evidence.unshift({ source: "git", kind: "context-over-cap", level: "error", message: "Review unit exceeds the outbound packet cap.", line: anchorFor(hunk).line });
    let lane = baseLane(file.path, evidence);
    if (overCap) lane = "blocker";
    const id = hash(`${file.path}\0${hunkIndex}\0${rawPatch}`);
    const copy = localCopy(file.path, lane, evidence);
    const blockedReason = redacted.blocked ? `secret guard matched ${redacted.kinds.join(", ")}` : overCap ? `packet exceeds ${MAX_PACKET_BYTES} bytes` : undefined;
    const remote = !blockedReason && hunk.lines.length > 0 && !TEST_PATH.test(file.path) && lane !== "noise";
    const summary = { paths: [file.path], bytes: Math.min(packetBytes, MAX_PACKET_BYTES), lines: contextHunk.lines.length, redactions: redacted.kinds.length, exclusions: overCap ? ["unit over packet cap"] : [] };
    const unit: RadarUnit = { id, file: file.path, hunk: hunkIndex, line: anchor.line, side: anchor.side, lane,
      title: `${hunk.section ?? file.path.split("/").pop()} · line ${anchor.line}`, chip: copy.chip, attention: null, remote,
      summary: copy.summary, ...(blockedReason ? { blockedReason } : {}), provenance: copy.provenance,
      distributions: null, sufficiency: blockedReason ? "insufficient" : "sufficient",
      context: { lines: contextHunk.lines.length, complete: !overCap }, truncation: overCap, redaction: redacted.blocked,
      cache: { state: "n/a", ms: 0 }, packet: summary };
    const packet: RadarPacket = { schemaVersion: 1, questionSetVersion: QUESTION_SET, model,
      file: { path: file.path, oldPath: file.oldPath, language: language(file.path), changeType: file.changeType, additions: file.additions, deletions: file.deletions },
      unit: { id, hunk: hunkIndex, line: anchor.line, side: anchor.side, patch: overCap ? redacted.text.slice(0, MAX_PACKET_BYTES) : redacted.text, contextTruncated: overCap, evidence } };
    drafts.push({ unit, packet });
  });
  return drafts;
}
