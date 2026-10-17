---
title: Code navigation
description: How nittle starts language servers, which ones it knows, and how to turn them off.
sidebar:
  order: 5
---

nittle can talk to a language server for the languages in your diff. It is optional. With no server installed everything else works the same, and nothing prints an error.

## How servers start

Servers start lazily. Opening a review starts nothing. A server for a language starts the first time something asks it a question, and only for languages that appear in the diff. Servers stay warm for the rest of the run and shut down when nittle exits, including ctrl+c, closing the last tab and the `--wait` exit paths.

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
