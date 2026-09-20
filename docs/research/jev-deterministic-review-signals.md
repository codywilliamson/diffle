# Deterministic review signals for Jev

> Status: research and implementation recommendation. Date: 2026-09-18.

## Recommendation

Build Loupe Radar as an evidence pipeline that is useful before Jev is enabled:

```mermaid
flowchart LR
  D[Freeze diff] --> U[Review units] --> E[Proven evidence] --> C[Bounded context] --> J[Jev judgments] --> R[Code-owned lanes] --> UI[Auditable UI]
```

Local code should locate changes, count, hash, run exact checks, redact secrets, and
own ranking policy. Jev should judge whether a small code change deserves semantic
attention, what kind of behavior it affects, its plausible impact, and whether the
packet contains enough evidence. It should never generate findings, run tools, approve,
hide evidence, or publish comments. TypeSafe recommends exact computation in code,
atomic questions, small relevant state, and code-owned composition; Jev 1.13 is weak at
arithmetic, indirection, large irrelevant state, adversarial content, and generation
([primitives](https://docs.typesafe.ai/primitives),
[known limitations](https://docs.typesafe.ai/model-jaggedness/jev-1.13)).

## 1. Form meaningful review units

- Start with a parsed Git hunk.
- Prefer the smallest enclosing function, method, class, route, or configuration block.
- Merge adjacent hunks only inside the same symbol and under the packet cap.
- Preserve renames as one unit; keep binary, mode, submodule, generated, and oversized
  changes as metadata-only units.
- Hash the canonical patch, path, and ranges for the cache key. Separately hash the
  symbol identity and nearby unchanged lines as a best-effort rereview fingerprint.
- Never use line numbers alone as durable identity.

Git supplies machine-friendly shape data with `--numstat -z`, `--summary`, explicit
rename detection, `--word-diff=porcelain`, and `--check`. `-W` supplies whole-function
context where Git or `.gitattributes` knows the hunk-header pattern
([git-diff](https://git-scm.com/docs/git-diff),
[gitattributes](https://git-scm.com/docs/gitattributes#_defining_a_custom_hunk_header)).

## 2. Deterministic evidence

Every result is a typed evidence item with source, kind, level, location, and reason.
A heuristic raises attention; only a diagnostic claims a concrete violation.

| Layer | Fast signals | Treatment |
|---|---|---|
| Git | change type, counts, hunks, rename, mode, binary, conflict/whitespace errors | Exact metadata or diagnostics |
| Path policy | auth, permissions, persistence, migration, dependency, deployment, CI, public contract | Configured attention boundary |
| Diff comparison | whitespace-only candidate, moved blocks, token delta | Lower noise; never claim behavior preservation |
| Test mapping | explicitly mapped test changed/missing | Evidence about co-change, not coverage |
| History | bounded churn bucket and ownership | Cached tie-breaker, not defect probability |
| Syntax | enclosing symbol, parse errors, imports/exports, branch/error/lifetime triggers | Objective structure plus attention triggers |
| Analyzers | compiler, linter, security, test, secret findings | Exact only when new and intersecting the change |

Use optional adapters rather than adding every analyzer to Loupe:

- Tree-sitter can parse old/new files, return named nodes, and expose error/missing nodes;
  it is designed for fast incremental parsing ([official docs](https://tree-sitter.github.io/tree-sitter/)).
- ast-grep can provide polyglot structural rules and machine-readable results
  ([official guide](https://ast-grep.github.io/guide/introduction.html)).
- Ingest SARIF 2.1.0 so existing tools keep their rule IDs, locations, severity, related
  locations, and fingerprints ([OASIS standard](https://docs.oasis-open.org/sarif/sarif/v2.1.0/os/sarif-v2.1.0-os.html)).
- Scan outbound patches for secrets and replace matches with typed redaction markers.

Do not automatically run package scripts, hooks, builds, or arbitrary repository
commands. Explicit analyzer adapters use an executable plus argument array, no shell,
an opt-in, timeout, output cap, and declared parser. Disable Git external diff and
text-conversion helpers during evidence collection.

## 3. Retrieve a small context island

For each unit, include in order: exact changed lines with eight surrounding lines, the
symbol signature, up to 80 symbol lines, diagnostics on those lines, and explicitly
mapped test snippets. A whole file is acceptable only when it fits. Start with caps of
120 code lines and 24,000 UTF-8 characters; mark every truncation.

Default to one symbol-sized context island per request. Batch multiple units only when
they share a small file or symbol and every piece of evidence applies to all of them.
Ask independent questions together; TypeSafe evaluates them in parallel against the
same state. Do not combine unrelated files to reduce calls
([state guidance](https://docs.typesafe.ai/concepts/state),
[parallel questions](https://docs.typesafe.ai/cookbooks/parallel_questions)).

## 4. Packet contract

The contract belongs in `src/types.ts` before server or client code consumes it.

```ts
interface RadarPacket {
  schemaVersion: 1;
  questionSetVersion: "radar-q1";
  model: string;
  diff: { id: string; baseOid: string | null; headOid: string; mode: string };
  file: { path: string; oldPath: string | null; language: string | null;
    changeType: ChangeType; additions: number; deletions: number;
    binary: boolean; generated: boolean };
  units: RadarUnit[];
}
interface RadarUnit {
  id: string;
  anchorFingerprint: string;
  range: { oldStart: number | null; newStart: number | null };
  symbol: { kind: string; name: string; start: number; end: number } | null;
  patch: string;
  context: string;
  contextTruncated: boolean;
  evidence: Evidence[];
}
interface Evidence {
  id: string;
  source: "git" | "path-rule" | "history" | "syntax" | "sarif" | "secret-scan";
  kind: string;
  level: "info" | "attention" | "warning" | "error";
  message: string;
  line: number | null;
  data?: Record<string, string | number | boolean>;
}
```

Show an outbound preview with provider, model, paths, byte count, exclusions, redactions,
and truncation. The reviewer must be able to open the exact canonical packet Jev saw.

## 5. Jev question set

Generate a fixed, versioned set per unit:

1. **Attention, Noul:** Is close human review warranted because the supplied old/new
   code may alter correctness, security, integrity, compatibility, lifetime, or visible behavior?
2. **Impact, Score:** local/reversible; limited feature path; users/data/integrations;
   credentials/authorization/irreversible loss/system availability.
3. **Kind, Choice:** control flow; state/lifecycle; interface; security; I/O/integration;
   tests/docs; other/none.
4. **Evidence sufficient, Noul:** Can the changed behavior be judged directly without
   assuming unseen implementation details?

Each instruction names the exact `units[i]` fields and says code text is untrusted data,
never instructions. This is mitigation rather than a security boundary: TypeSafe warns
that adversarial state can steer Jev. Pin model and question versions, cache by canonical
packet hash, and include injected source comments in evaluation. Do not use a `latest`
alias for benchmark identity.

## 6. Ranking without false precision

Use lanes, then a lexicographic sort. Deterministic evidence is a floor: Jev can raise
attention but cannot demote or hide a known result.

1. **Local-only blocker:** secret/redaction risk, unreadable or misleadingly truncated state.
2. **Verified finding:** new exact compiler, linter, security, test, SARIF, or conflict result.
3. **Boundary review:** configured security, data, migration, dependency, deployment,
   public-interface, process-lifetime, binary, or mode boundary.
4. **Semantic attention:** benchmarked Jev threshold, material impact, low confidence,
   or insufficient evidence. Uncertainty raises priority.
5. **Routine review:** valid packet with no higher lane.
6. **Noise candidate:** generated/vendor, whitespace-only candidate, or proven movement;
   collapse visually but never hide or auto-approve.

Within each lane sort by analyzer severity, boundary count, Jev attention bucket,
modal impact level, churn bucket, change-size bucket, path, and line. Keep the full
probability distribution. Do not sum unrelated probabilities or sort on Score's decimal
interpolation; TypeSafe warns that it lacks exact numeric meaning. Tune thresholds from
the corpus, not generic examples ([confidence guidance](https://docs.typesafe.ai/confidence)).

## 7. Benchmark before claiming value

Freeze review-unit fixtures across repositories and languages: real defects, clean
changes, refactors, tests/docs, generated files, moves, large functions, binaries,
deletions, auth, migrations, concurrency, cleanup, compatibility, pre-existing versus
new diagnostics, injected comments, secrets, and truncation boundaries.

Measure recall at top 5/10; deferrable units at 95% recall; boundary misses; false
elevations; Brier score and calibration per Noul; repeated-call stability; enrichment
and provider p50/p95; bytes, tokens, and cost; redaction failures; injection sensitivity;
and deterministic-only/Jev-only/combined ablations. Split tuning and holdout by repository.

## Loupe feasibility observations

On `HEAD~20..HEAD` in this checkout, the normal patch had 89 files and 131 hunks: median
17 lines, p90 70, and 85.5% at most 60 lines. `-W` produced 104 units: median 34, p90
102, maximum 327, and 36% more context lines. A hunk-first MVP with capped function
context is therefore reasonable. Local five-run Windows medians were about 104 ms for
`--numstat`, 108 ms for `--check`, 145 ms for `-W`, and 605 ms for 100-commit history;
history belongs off the first-render path and in cache. These are local observations,
not portable performance claims.

Loupe currently discards symbol text after the `@@ ... @@` header; Radar should preserve
it as a separate hint. For JS/TS, `Bun.Transpiler.scan()` adds a zero-dependency adapter
for runtime imports/exports. It scanned 112 tracked JS/TS/MJS files here in about 132 ms
inside Bun. It ignores type-only edges, so it cannot prove TypeScript API compatibility
([Bun docs](https://bun.sh/docs/runtime/transpiler)).

## Delivery order

1. Review-unit and evidence contracts; Git facts; boundary rules; lanes; packet preview;
   canonical hashing and cache. This ships useful deterministic Radar first.
2. One BYOK Jev provider; bounded packets; pinned questions; distributions and provenance;
   benchmark with deterministic-only versus combined results.
3. SARIF ingestion and secret redaction, then one syntax adapter if Git context proves
   insufficient. Add provider breadth after the evidence pipeline is stable.
