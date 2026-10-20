---
title: Code navigation
description: How nittle starts language servers, which ones it knows, and how to turn them off.
sidebar:
  order: 5
---

nittle can talk to a language server for the languages in your diff. It is optional. With no server installed everything else works the same, and nothing prints an error.

## How servers start

Servers start lazily. Opening a review starts nothing. A server for a language starts the first time something asks it a question, and only for languages that appear in the diff. Servers stay warm for the rest of the run and shut down when nittle exits. A normal review keeps running until you press ctrl+c or run `nittle cleanup`, and closing the last browser tab does not end it. With `--wait`, closing the last tab ends the process, and so do its other exit paths.

Pass `--no-lsp` to start none at all. The flag works on the default command and on `nittle show`.

```sh
nittle --no-lsp
nittle show HEAD~2 --no-lsp
```

## Language servers are your binaries

Language servers are programs you install yourself. nittle runs the binary it finds on your `PATH`, with your user rights, in the repository root, and talks to it over stdio. It never downloads one for you, and nothing listens beyond nittle's existing localhost server. Treat a language server like any other tool you run in a checkout: only install ones you trust.

nittle does not write into your checkout. Server logs and caches go to a temp directory that is removed on exit. For C#, nittle asks the Roslyn server not to run automatic restore, which would otherwise create `obj/` folders.

## Install hints

| Language | Extensions | Server (first found on PATH wins) | Install |
| --- | --- | --- | --- |
| TypeScript / JavaScript | ts, tsx, mts, cts, js, jsx, mjs, cjs | `typescript-language-server --stdio` | `npm install -g typescript-language-server typescript` |
| C# | cs | `roslyn-language-server`, then `csharp-ls` | `dotnet tool install -g roslyn-language-server --prerelease` or `dotnet tool install -g csharp-ls` |

The TypeScript server needs a `typescript` package it can resolve, either in the project's `node_modules` or installed globally next to the server. TypeScript 7 (the native port) has no `tsserver.js`, so use TypeScript 5.x with this server.

## Status

`GET /api/lsp/status` reports a state for each language in the diff. Asking for status never starts a server.

- `missing`: no server found on `PATH`. The response includes an install hint.
- `idle`: installed, not started yet.
- `starting`: launched, finishing the initialize handshake.
- `indexing`: the server reports progress while it loads the project.
- `ready`: answering requests.
- `failed`: crashed twice (a crashed server is restarted once). The last stderr output is included.

Under `--no-lsp` the response is `{ "enabled": false, "languages": [] }`.

## Navigation endpoints

These routes sit behind the same loopback Origin and Host checks as the status route. Each request body is `{ path, side, line, character }`. `line` is 1-based and `character` is a 0-based JavaScript string offset. nittle converts to the position encoding the server negotiated (UTF-8, UTF-16 or UTF-32) and back, so lines with emoji or CJK text land on the right token. Every range in a response uses the same client coordinates.

- `POST /api/lsp/definition` returns `targets` (`uri`, `path`, `absolutePath`, `range`, `inRepo`, `inDiff`) from a Location, Location[] or LocationLink[] answer. `kind: "typeDefinition"` asks for the type instead. `onDefinition: true` means the cursor already sits on the declaration, so the client shows references instead. Targets outside the repository (the standard library, `node_modules`, site-packages) come back with `inRepo: false` and `path: null`.
- `POST /api/lsp/hover` returns markdown in `contents`, empty when the server has nothing to say. A newer hover from the same client (the `x-client-id` header) cancels the one still waiting on the server, and so does closing the connection.
- `POST /api/lsp/references` returns references grouped by file, with the files in the diff first and marked `changed: true`. Each reference carries a few lines of context. The list is capped at 200 and reports `total` and `truncated`.
- `GET /api/lsp/symbols?path=` returns the document outline as a tree. Symbols that overlap a changed line carry `changed: true`. `GET /api/lsp/symbols?query=` asks every server for the languages in the diff, merges the answers and caps them at 100.
- `GET /api/lsp/file?uri=` returns read-only text for a target outside the diff. It only serves paths that a navigation answer already returned in this run, so it can't be pointed at arbitrary files.

A review with no base commit (browse mode) has no old side. Requests for that side answer `409` with `code: "old-side-unsupported"`.

When no server is usable, every route answers `409` with `{ code: "server-unavailable", state, hint }`. It is never a 500, and nothing is logged as an error. The first request after a server starts also waits for the server to finish loading the project, because answers before that are unreliable.

## Limits today

Language servers read your checkout from disk. For a branch, range or commit review, answers that point into other files can reflect the checked-out files instead of the reviewed revision. The old side of a diff can't be navigated at all. Both limits stay until nittle can serve those revisions from a detached worktree (tracked in issue 186), and it will never switch your checkout to do it.

## Coming next

The server side for go-to-definition, hover and references is in. The review UI doesn't use it yet, so there are no keys to press. They land in a later release, and this page will list them when they do.
