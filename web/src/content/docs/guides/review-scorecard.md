---
title: Review scorecard
description: Triage a diff with a deterministic scorecard, a review order grouped by project, and per-file risk flags.
sidebar:
  order: 3
---

The review scorecard summarizes a diff before you read it: how big it is, whether it has tests, what changed in the public API, dependencies, and risky spots. Nothing is inferred by AI. Every band comes from a fixed rule, so the same diff always gets the same scorecard, and agents get the same one over MCP.

## Open the scorecard

Click **Scorecard** in the top bar, or press `g`. The button's dot shows the worst band across all six categories. The panel shows:

- **Totals**: effective lines, files, and how many noise lines were hidden.
- **Six categories**, each marked Low, Medium, or High, with a summary and the files behind it.

Click a file in a category to jump to it.

## Categories

| category | medium at | high at |
| --- | --- | --- |
| Size | 200 effective lines | 600 effective lines |
| Tests | 1 changed code file with no test in the diff | 3 such files |
| Public API | any public or protected member or export added | any removed |
| Dependencies | any dependency change | a removed dependency, a `TargetFramework` change, or a `dotnet sdk` change |
| Hotspots | 1 frequently changed file | 3 |
| Flags | any flag | 5 or more flags, or a sensitive path alongside a removed public API |

**Effective lines** are added plus deleted lines, minus noise (see below). A declaration moved verbatim between files is not counted as an API change.

**Tests** looks for a matching test in the same diff. In C#, `FooTests.cs` or `FooSpecs.cs` pairs with `Foo.cs`, and any file in a `*.Tests` project counts as a test. In TypeScript and JavaScript, test folders and `.test.` or `.spec.` files pair by name. Only added or modified code files are checked; docs, config, and generated files are not.

**Hotspots** counts commits to a file in the last 90 days, excluding the change under review. A file with 10 or more commits is flagged.

**Dependencies** covers NuGet `PackageReference` and `PackageVersion` entries (`.csproj`, `Directory.Packages.props`, `Directory.Build.props`), `TargetFramework(s)`, `global.json` SDK versions, `nuget.config` sources, and `package.json` dependencies.

## Flags

Flags are per-line or per-file signals. The Flags category counts sensitive paths, leftovers, and large files (300 or more effective lines in one file).

**Sensitive paths**

- C#: EF `Migrations/` folders, `Program.cs`, `Startup.cs`, `appsettings*.json`, `*.csproj`, `Directory.Build.props` and `.targets`, `web.config`.
- Any language: `.github/workflows/` and CI pipeline files, Dockerfiles and compose files, `.env` files, migrations, and auth, authentication, authorization, or security folders.

**Leftovers** are added lines that look unfinished. Each file reports up to five; the rest are summarized as a count.

- C#: `Debugger.Break` or `Launch`, `#pragma warning disable`, skipped (`Skip=`) and ignored tests, `async void` methods (event handlers with an `object sender` are allowed), `.Result`, `.Wait()`, `.GetAwaiter().GetResult()`, and `null!`.
- TypeScript and JavaScript: `console.log`, `debugger`, `.only(`, `it`/`describe`/`test` `.skip`, `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, and `as any`.
- All languages: `TODO`, `FIXME`, and `HACK` markers.

## Noise

Noise is excluded from effective lines and collapsed in the diff:

- Lockfiles: `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lock`, `packages.lock.json`, `go.sum`, `Cargo.lock`, and others.
- Generated output: `*.min.js`, `*.min.css`, `*.map`, `*.snap`, `__snapshots__/`, and C# `*.g.cs`, `*.designer.cs`, `*.generated.cs`, and `.cs` files under `obj/`.
- Any file marked `linguist-generated` in `.gitattributes`.

Whitespace-only hunks and moved code are also left out of the line counts.

## Review order

Switch the file list from **Tree** to **Review order** with the sidebar toggle or `m`. Files are grouped so you read one project at a time:

- **C#**: grouped by the nearest `.csproj`. Projects are ordered by `ProjectReference`, so dependencies come first.
- **TypeScript and JavaScript**: grouped by the nearest `package.json`, or by top-level folder.
- **Other languages**: grouped by top-level folder.

Within a group, each source file is followed by its test. Generated files and lockfiles go to a final **Generated & lockfiles** group. `j` and `k` follow the active order.

## In the diff

- Generated files and lockfiles start collapsed. Files marked `linguist-generated` are treated the same way.
- Whitespace-only hunks are dimmed and labeled.
- Moved code blocks show **moved from** or **moved to** links with the other file and line.
- Each file header shows chips for its flags, hotspot status, and test pairing. **Details** opens the reasons.

## Changed since last review

When a reviewer returns feedback, diffle saves each file's content. On the next round, files that changed since then show a **Changed since last review** chip. Turn on the toggle to show only those changes. The view is read-only, so use it to check the agent's follow-up work without rereading the whole diff.

## Over MCP

`get_scorecard` takes a `reviewId` and returns the same scorecard, review order, noise, and flags the reviewer sees. See [MCP tools](/reference/mcp-tools/).

## Next steps

- Read the diff with [Reviewing changes](/guides/reviewing-changes/).
- Leave feedback with [Inline comments](/guides/inline-comments/).
