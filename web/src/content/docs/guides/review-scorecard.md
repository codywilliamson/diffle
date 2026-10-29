---
title: Review scorecard
description: Triage a diff before reading it with a rule-based scorecard, a review order grouped by project, and noise collapsed out of the way.
sidebar:
  order: 6
---

Use the scorecard to see where a diff is risky before you read it, then read the files in dependency order. Every band comes from a fixed rule, with no AI involved, so the same diff always gets the same scorecard. Agents get the same one over MCP with `get_scorecard`.

<video src="/media/takes/scorecard.mp4" poster="/media/takes/scorecard.jpg" autoplay muted loop playsinline width="1280" height="800"></video>

## Open the scorecard

Click Scorecard in the top bar, or press `gc`. The dot on the button shows the worst band across all six categories.

The panel opens with the totals, such as `412 effective lines · 9 files · 1830 noise lines hidden`. Below that is one row per category, each with a Low, Medium or High band and a one-line summary. Click a row with a chevron to see its reasons, one per file or flag, up to eight and then `+N more`.

Under the categories, Files lists every file that has a flag, recent churn, or changes since the last review. Click a path to jump to that file.

![The review scorecard: six categories with bands, and the flagged files below](/media/gallery/scorecard.png)

## What sets each band

| category | Medium at | High at | a reason reads like |
| --- | --- | --- | --- |
| Size | 200 effective lines | 600 effective lines | `src/api.ts: 140 effective lines` (the three biggest files) |
| Tests | 1 changed code file with no test in the diff | 3 such files | `src/api.ts: code change with no matching test in this diff` |
| Public API | any public or protected member or export added | any removed | ``Orders.cs: removed public class `OrderService` `` |
| Dependencies | any dependency change | a removed dependency, or a `TargetFramework` or `dotnet sdk` change | `changed dependency Serilog from 3.1.1 to 4.0.0` |
| Hotspots | 1 frequently changed file | 3 such files | `src/Orders.cs: 14 commits in the last 90 days` |
| Flags | any flag | 5 or more flags, or a sensitive path in the same diff as a removed public API | `appsettings.json: sensitive path: app startup or build config (appsettings.json)` |

Effective lines are added plus deleted lines, minus noise, whitespace-only hunks and code that only moved. A moved block that was also edited counts its edited lines. A declaration moved verbatim to another file doesn't count as an API change.

Tests pairs each changed code file with a test in the same diff. In C#, `FooTests.cs`, `FooTest.cs`, `FooSpecs.cs` or `FooSpec.cs` pairs with `Foo.cs`, and any file in a project folder ending in `.Tests`, `.UnitTests`, `.IntegrationTests` or `.Specs` counts as a test. In TypeScript and JavaScript, `*.test.*`, `*.spec.*` and `*.pw.*` files and `__tests__/` folders pair by name. In every other language, files in `test`, `tests`, `spec`, `specs` or `__tests__` folders and files named `test_*`, `*_test.*` or `*.spec.*` pair by name. Only added or modified code files are checked. Docs, config and generated files aren't.

Hotspots counts commits to each file in the last 90 days, not counting the change under review. A file with 10 or more is a hotspot. A shallow clone or a repo with no history reports zero.

Dependencies reads NuGet `PackageReference`, `PackageVersion` and `GlobalPackageReference` entries (`.csproj`, `Directory.Packages.props`, `Directory.Build.props`), `TargetFramework(s)`, `global.json` SDK versions, `nuget.config` sources, and `package.json` dependencies.

## Flags

Flags counts three kinds of signal: sensitive paths, leftovers, and large files (300 or more effective lines in one file).

Sensitive paths:

- C#: `Program.cs`, `Startup.cs`, `appsettings*.json`, `*.csproj`, `Directory.Build.props` and `.targets`, `web.config`, and EF `Migrations/` folders.
- Any language: `.github/workflows/` and other CI pipeline files, Dockerfiles and compose files, `.env` files, migrations, and auth, authentication, authorization or security folders.

Leftovers are added lines that look unfinished. A file reports up to five, and the rest show as `+N more leftovers in this file`.

- C#: `Debugger.Break` or `Debugger.Launch`, `#pragma warning disable`, skipped (`Skip =`) and ignored tests, `async void` methods (event handlers taking `object sender` are allowed), `.Result`, `.Wait()`, `.GetAwaiter().GetResult()`, and `null!`.
- TypeScript and JavaScript: `console.log`, `debugger`, `.only(`, `it.skip`, `describe.skip`, `test.skip`, `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, and `as any`.
- Every language: `TODO`, `FIXME` and `HACK`.

In the diff, each file header shows chips for its flags, hotspot status and test pairing. Details opens the full list.

## Review order

Switch the sidebar from Tree to Review order, or press `m`, to read one project at a time in dependency order.

![The sidebar in review order: C# projects ordered by ProjectReference, each source file followed by its test](/media/gallery/review-order.png)

- C#: `.cs`, `.razor`, `.cshtml` and project files group under the nearest `.csproj`. Projects are sorted by their `ProjectReference` entries, so a project comes after the projects it references. A `Core` library you changed reads before the `Api` project that uses it.
- TypeScript and JavaScript: files inside a folder with its own `package.json` group under that folder. Files owned only by the root `package.json` group by top-level folder.
- Every other language: files group by top-level folder.

Groups with no dependency between them, and any reference cycle, fall back to alphabetical order. Inside a group, each source file is followed by its test, and tests with no source file in the diff come last. Lockfiles and generated files go to a final Generated & lockfiles group. `J` and `K` follow review order while it's on.

## Noise

Noise is left out of the effective line count, and its files start collapsed:

- Lockfiles: `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lock`, `packages.lock.json`, `go.sum`, `Cargo.lock`, `poetry.lock`, `uv.lock`, `composer.lock`, `Gemfile.lock` and others.
- Generated output: `*.min.js`, `*.min.css`, `*.map`, `*.snap` and `__snapshots__/`.
- C# generated code: `*.g.cs`, `*.g.i.cs`, `*.designer.cs`, `*.generated.cs`, `*ModelSnapshot.cs`, and `.cs` files under `obj/`.
- TypeScript and JavaScript files named `*.generated.*` or `*.gen.*`.
- Any path marked `linguist-generated` in `.gitattributes`, read from the side under review.

Whitespace-only hunks and moved code also stay out of the count. In the diff they're dimmed or marked, as shown in [Reviewing changes](/guides/reviewing-changes/#spot-whitespace-and-moved-code).

## Changed since last review

Each time you return feedback, nittle saves the content of every file. On the next round, files that changed since then get a Changed since last review chip in their header and in the scorecard's file list. Turn on the toggle in the header to show only what changed since that round. That view is read-only, and in-file search is off while it shows.

## Over MCP

`get_scorecard` takes a `reviewId` and returns the same categories, review order, noise and flags you see. See [MCP tools](/reference/mcp-tools/).

## Related pages

- Read the files with [Reviewing changes](/guides/reviewing-changes/) or [Keyboard review](/guides/keyboard-review/).
- Leave feedback with [Inline comments](/guides/inline-comments/).
