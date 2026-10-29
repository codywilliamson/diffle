---
title: Code navigation
description: Go to definitions, read hover docs and list references in the diff, using language servers you install.
sidebar:
  order: 8
---

Jump from a name in the diff to its definition, its docs and its references without leaving the review. nittle asks a language server you've installed. With none installed, everything else works the same and nothing prints an error.

<video src="/media/takes/codenav.mp4" poster="/media/takes/codenav.jpg" autoplay muted loop playsinline width="1280" height="800"></video>

## Install a language server

Run `nittle lsp` to see what each language gets. This is real output from a machine with only `gopls` installed:

```
$ nittle lsp
typescript  not on PATH (tried typescript-language-server)  npm install -g typescript-language-server typescript
csharp      not on PATH (tried roslyn-language-server, csharp-ls)  dotnet tool install -g roslyn-language-server --prerelease (or: dotnet tool install -g csharp-ls)
python      not on PATH (tried pyrefly, basedpyright-langserver)  pip install pyrefly (or: pip install basedpyright)
go          C:\Users\Cody\go\bin\gopls.exe
rust        not on PATH (tried rust-analyzer)  rustup component add rust-analyzer
vue         not on PATH (tried vue-language-server)  npm install -g @vue/language-server
svelte      not on PATH (tried svelteserver)  npm install -g svelte-language-server
```

Run the install command for the languages you review, then run `nittle lsp` again to check. `gopls` comes from `go install golang.org/x/tools/gopls@latest`.

| language | extensions | servers, first found on PATH wins |
| --- | --- | --- |
| TypeScript / JavaScript | ts, tsx, mts, cts, js, jsx, mjs, cjs | `typescript-language-server` |
| C# | cs | `roslyn-language-server`, then `csharp-ls` |
| Python | py, pyi | `pyrefly`, then `basedpyright-langserver` |
| Go | go | `gopls` |
| Rust | rs | `rust-analyzer` |
| Vue | vue | `vue-language-server` |
| Svelte | svelte | `svelteserver` |

The TypeScript server needs a `typescript` package it can resolve, in the project's `node_modules` or installed globally next to the server. TypeScript 7 (the native port) has no `tsserver.js`, so use TypeScript 5.x with it.

For Python, an active virtualenv (`VIRTUAL_ENV`) is searched before `PATH`, so site-packages resolve.

## Pick a different server

`nittle lsp set` stores a command for one language. Quote it when it has arguments, and pass `""` to turn the language off:

```sh
nittle lsp set python "basedpyright-langserver --stdio"
nittle lsp set rust ""
nittle lsp unset python
```

Overrides live in `~/.nittle/state.json`, and `nittle lsp` lists them after the table. Commands run directly, not through a shell.

For one run only, pass `--lsp`. An empty command turns that language off. `--no-lsp` starts no servers at all. Both work on `nittle` and `nittle show`:

```sh
nittle --lsp rust=rust-analyzer
nittle show HEAD~2 --no-lsp
```

## Go to a definition

Put the cursor on a line (`j`, `k`) and press `gd`. The keyboard moves a row, not a column, so the key acts on the word your pointer last rested on in that row. With no such word, it uses the row's first identifier.

- `gd` goes to the definition. On the definition itself, it lists the references instead.
- `gy` goes to the type definition.
- `gh` shows the hover docs in a card.
- `gA` lists references in a panel, grouped by file, with the files in the diff first.
- `gs` lists the symbols in this file, and `gS` searches symbols across the repository.

![Hover docs for a function in the diff](/media/gallery/code-nav-hover.png)

The pointer works too. `Ctrl`+click (`Cmd`+click on macOS) goes to the definition, and holding the key shows words as links. Resting the pointer on a word shows its hover docs.

When a lookup finds several definitions, a picker lets you choose one. `Ctrl+o` comes back from any jump.

![The references panel, grouped by file with changed files first](/media/gallery/code-nav-references.png)

## Read code outside the diff

A definition in a file outside the diff, such as `node_modules` or the standard library, opens in a read-only viewer. Inside it, `gd`, `gy` and `Ctrl`+click keep following definitions. `j`, `k`, `gg` and `G` scroll it. `Ctrl+o` steps back through the viewer hops, then returns to the diff.

A file outside the repository can't be asked about. A lookup from one says "Definitions can only be followed from files in the repository, not from this file outside the repository."

`Esc` closes the topmost layer first: the hover card, the picker, the symbols list, the viewer, then the references panel.

## Removed lines and other revisions

A language server reads files from disk, so it can only answer for a revision that's on disk. nittle never checks anything out in your repository to get there. Instead, a side of the review that isn't your checkout gets a detached git worktree in your system temp directory:

- Working-tree and staged reviews use your repository as it is.
- A side at the commit your checkout is on, with a clean `git status`, uses your repository too.
- Every other side gets a worktree at its commit: the new side of a branch review or a range, `nittle show <commit>`, and the old side of most reviews. That's what makes `gd` and `gh` work on removed lines.
- Browse mode has no old side, so removed-line lookups aren't available there.

The worktrees live under `<temp>/nittle-lsp-wt-<pid>-<random>/` (`%TEMP%` on Windows, `$TMPDIR` or `/tmp` elsewhere). They're detached, so no branch is created and your HEAD, index and working tree are untouched. Git lists them under `.git/worktrees/` while they exist.

A temp worktree has tracked files only. So a TypeScript server can see your packages, nittle links your `node_modules` into it for the repo root and each package with a tracked `package.json` (up to 50). Without a `node_modules` to link, navigation still works for the repository's own files.

After you edit your checkout, press `r` before navigating again, since the clean check is cached until the next refresh.

They're removed when the review ends. A hard kill (power loss, SIGKILL) leaves them behind, and `nittle cleanup` lists and removes them after you confirm. Run it from inside the repository.

## What the servers can touch

Language servers are programs you install. nittle runs the one it finds on `PATH` with your user rights and talks to it over stdio. It never downloads a server, and a server found inside the repository under review is ignored, so a checkout can't plant its own. Only install servers you trust.

Servers start the first time something asks them a question, only for languages in the diff, and stop when nittle exits. Their logs go to a temp directory that is removed on exit. For C#, nittle asks Roslyn not to run automatic restore, which would create `obj/` folders in your checkout.

The routes the browser uses for this are in the [HTTP API](/reference/http-api/) reference.

## Next steps

- Find text instead of symbols with [Searching](/guides/searching/).
- See every key in [Keyboard shortcuts](/reference/keyboard-shortcuts/).
