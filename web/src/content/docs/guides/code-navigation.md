---
title: Code navigation
description: How nittle starts language servers, which ones it knows, and how to turn them off.
sidebar:
  order: 5
---

nittle can talk to a language server for the languages in your diff. It is optional. With no server installed everything else works the same, and nothing prints an error.

## How servers start

Servers start lazily. Opening a review starts nothing. A server for a language starts the first time something asks it a question, and only for languages that appear in the diff. Servers stay warm for the rest of the run and shut down when nittle exits. A normal review keeps running until you press ctrl+c, or until `nittle cleanup --all` stops it. Bare `nittle cleanup` stops only finished sessions. Closing the last browser tab does not end the review. With `--wait`, closing the last tab ends the process, and so do its other exit paths.

Pass `--no-lsp` to start none at all. The flag works on the default command and on `nittle show`.

```sh
nittle --no-lsp
nittle show HEAD~2 --no-lsp
```

## Language servers are your binaries

Language servers are programs you install yourself. nittle runs the binary it finds on your `PATH`, with your user rights, in a temp log directory, and talks to it over stdio. The review root reaches the server through the LSP initialize request, not as the working directory. It never downloads one for you, and nothing listens beyond nittle's existing localhost server. Treat a language server like any other tool you run in a checkout: only install ones you trust.

nittle does not write into your checkout. Server logs and caches go to a temp directory that is removed on exit. For C#, nittle asks the Roslyn server not to run automatic restore, which would otherwise create `obj/` folders.

## Install hints

| Language | Extensions | Server (first found on PATH wins) | Install |
| --- | --- | --- | --- |
| TypeScript / JavaScript | ts, tsx, mts, cts, js, jsx, mjs, cjs | `typescript-language-server --stdio` | `npm install -g typescript-language-server typescript` |
| C# | cs | `roslyn-language-server`, then `csharp-ls` | `dotnet tool install -g roslyn-language-server --prerelease` or `dotnet tool install -g csharp-ls` |
| Python | py, pyi | `pyrefly lsp`, then `basedpyright-langserver --stdio` | `pip install pyrefly` or `pip install basedpyright` |
| Go | go | `gopls` | `go install golang.org/x/tools/gopls@latest` |
| Rust | rs | `rust-analyzer` | `rustup component add rust-analyzer` |
| Vue | vue | `vue-language-server --stdio` | `npm install -g @vue/language-server` |
| Svelte | svelte | `svelteserver --stdio` | `npm install -g svelte-language-server` |

The TypeScript server needs a `typescript` package it can resolve, either in the project's `node_modules` or installed globally next to the server. TypeScript 7 (the native port) has no `tsserver.js`, so use TypeScript 5.x with this server.

`nittle lsp` prints what each language would run and how to install what is missing, and lets you pick a different server. See [Language servers](/reference/configuration/#language-servers).

## Status

`GET /api/lsp/status` reports a state for each language in the diff. Asking for status never starts a server.

- `missing`: no server found on `PATH`. The response includes an install hint.
- `idle`: installed, not started yet.
- `starting`: launched, finishing the initialize handshake.
- `indexing`: the server reports progress while it loads the project.
- `ready`: answering requests.
- `failed`: crashed twice (a crashed server is restarted once). The last stderr output is included.

Under `--no-lsp` the response is `{ "enabled": false, "languages": [] }`.

## Keys and the mouse

Code navigation works from the keyboard and the pointer. The keyboard moves a row cursor, not a column, so a key acts on the word the pointer last rested on in the cursor's row. With no such word, it uses the row's first identifier.

- `gd` goes to the definition. On a definition it lists the references instead. `gy` goes to the type definition.
- `gh` shows the hover docs for the cursor word in a card.
- `gA` lists the references, in a panel grouped by file with the changed files first.
- `gs` opens the symbols in this file in a picker, and `gS` the symbols in the repository.
- Ctrl/Cmd+click goes to the definition of the word under the pointer. Resting the pointer on a word shows its hover docs.

When a lookup returns several definitions, a picker lets you choose one. A target outside the diff, such as a file in the standard library or `node_modules`, opens in a read-only viewer. Esc closes the topmost layer first: the hover card, the picker, the symbols, the viewer, then the references panel.

Inside the viewer, `gd`, `gy` and Ctrl/Cmd+click follow definitions too, so you can keep going past the first hop. The lookup runs on the viewed file's own side, so a file opened from the old side asks about the old version. With no pointer word, `gd` uses the first identifier on the highlighted line. Ctrl+o steps back through the viewer hops, then returns to where you were in the diff. `gg` scrolls the viewer to the top. A file outside the repository can't be asked about, so a lookup there shows a notice instead.

## Navigation endpoints

These routes sit behind the same loopback Origin and Host checks as the status route. The three POST routes take a JSON body `{ path, side, line, character }`. `symbols` and `file` take query parameters instead. `line` is 1-based and `character` is a 0-based JavaScript string offset. When nittle can read the target's text, it converts to the position encoding the server negotiated (UTF-8, UTF-16 or UTF-32) and back, so lines with emoji or CJK text land on the right token. Ranges then use the same client coordinates. The text is read only for files up to 2 MiB. For any other target, the server's character offsets pass through unchanged, which is exact only for UTF-16 servers.

- `POST /api/lsp/definition` returns `targets` (`uri`, `path`, `absolutePath`, `range`, `inRepo`, `inDiff`) from a Location, Location[] or LocationLink[] answer. `kind: "typeDefinition"` asks for the type instead. `onDefinition: true` means the cursor already sits on the declaration, so the client shows references instead. Targets outside the repository (the standard library, `node_modules`, site-packages) come back with `inRepo: false` and `path: null`.
- `POST /api/lsp/hover` returns markdown in `contents`, empty when the server has nothing to say. A newer hover from the same client (the `x-client-id` header) cancels the one still waiting on the server, and so does closing the connection.
- `POST /api/lsp/references` returns references grouped by file, with the files in the diff first and marked `changed: true`. Each reference carries a few lines of context. The list is capped at 200 and reports `total` and `truncated`.
- `GET /api/lsp/symbols?path=` returns the document outline as a tree. Symbols that overlap a changed line carry `changed: true`. `GET /api/lsp/symbols?query=` asks every server for the languages in the diff, merges the answers and caps them at 100.
- `GET /api/lsp/file?uri=` returns read-only text for a target outside the diff. It only serves paths that a navigation answer already returned in this run, so it can't be pointed at arbitrary files.

A review with no base commit (browse mode) has no old side. Requests for that side answer `409` with `code: "old-side-unsupported"`.

`GET /api/lsp/status` always answers `200`. The navigation routes answer `409` with `code: "server-unavailable"` and the server's `state` when no server can answer. The `hint` field appears only sometimes, and `stderr` appears when the server printed any. `GET /api/lsp/file` returns the text, or a validation error for a bad `uri`, `403` for a path that no navigation answer returned, and `404` with `code: "file-not-found"` for an authorized target that can't be read or is over 2 MiB.

The first request after a server starts waits for the server to finish loading the project, because answers before that are unreliable. The wait is bounded. If the server reports progress, the request waits for that progress to end. If no progress starts within 2 seconds, it goes ahead. It never waits longer than 20 seconds.

## Revisions other than your checkout

A language server reads files from disk, so it can only answer for a revision that is on disk. nittle never checks a revision out in your repository to get there. Each side of the review gets a root. For a side that isn't your clean checkout at its commit, that root is a detached git worktree in your system temp directory.

### Which root each side gets

- Working-tree and staged reviews use your repository.
- A side whose commit is the one your checkout is on, with a clean `git status`, uses your repository. This applies to either side, so an old side at HEAD gets no worktree either.
- Everything else gets a worktree at that side's commit. The new side of a branch, a range, `nittle show <commit>`, or a branch review with uncommitted edits all fall here.
- The old side gets a worktree at the base commit in the other cases. That is what makes go-to-definition and hover work on removed lines. Browse mode has no base commit, so it has no old side.

Each request only talks to the servers rooted where its side lives. A workspace symbol search from the working tree never reaches the servers of an old-side worktree.

### Where it is

```
<temp dir>/nittle-lsp-wt-<pid>-<random>/new
<temp dir>/nittle-lsp-wt-<pid>-<random>/old
<temp dir>/nittle-lsp-wt-<pid>-<random>/owner.json
```

`<temp dir>` is `%TEMP%` on Windows and `$TMPDIR` (or `/tmp`) elsewhere. The worktrees are detached, so no branch is created and nothing is written to your HEAD, index or working tree. Git lists them under `.git/worktrees/` while they exist. They are created on the first request that needs one, with hooks disabled. `owner.json` records the process id, the repository, and the worktree and link paths, so cleanup can prove a leftover is nittle's.

### When the review moves

Each request checks which commit its side should be at, once per diff refresh. When the review moves, the worktree runs `git checkout --detach`, but only while its own `git status --porcelain` is clean. If it isn't clean, or the checkout fails, the side answers `409` with `code: "worktree-blocked"`, and `GET /api/lsp/status` reports the reason in `blocker`. A worktree side never answers from a revision other than the one it was last moved to. A side that uses your checkout is different. The clean check for that side is cached until the next refresh (Re-run, or `r`), so edits you make in the checkout before refreshing can show up in answers. Refresh after editing. Commit or discard the changes in the temp worktree and the next refresh moves it.

### Installed dependencies

A temp worktree holds tracked files only, so a TypeScript server there wouldn't see your packages. For the repository root and each package directory with a tracked `package.json` (up to 50), nittle links your `node_modules` into the worktree when your checkout has one. The link is a junction on Windows and a symlink elsewhere. If a directory has no `node_modules`, or the link can't be made, navigation still works for the repository's own files and `GET /api/lsp/status` carries `limited: "dependencies unavailable"`.

The server can read, and in principle write, through that link into your real `node_modules`. nittle turns off automatic typings acquisition for TypeScript servers and points server logs at a separate temp directory. It has no switch that makes a server read-only. Removal never follows the link: it is unlinked first, and if that fails the worktree is left alone.

### Cleanup

Approve and cancel in a normal review do not remove the worktrees. They only update the review record. With `--wait`, the process removes them when it exits after the outcome. Otherwise they go when the session ends, or with `nittle cleanup`.

Removal unlinks the dependency links, runs `git worktree remove --force` on each temp path, and removes that worktree's entry under `.git/worktrees/` if git left one behind. It never runs a repository-wide `git worktree prune`. The temp directory is removed only when it is empty.

A hard kill (SIGKILL, power loss) leaves the worktrees behind. `nittle cleanup` lists them and removes them after confirmation. It only touches a `new` or `old` directory under `<temp dir>/nittle-lsp-wt-<pid>-*/` whose `owner.json` names this repository, this worktree and a process that is no longer running. A worktree that git still lists is removed through git. A directory that git doesn't list, such as one left by a creation that was interrupted, is removed only when it is empty. Run it from inside the repository. A leftover without a readable `owner.json` is left alone.

