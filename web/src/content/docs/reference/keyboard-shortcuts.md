---
title: Keyboard shortcuts
description: Every key nittle's review UI binds, grouped by what it acts on, with counts, chords and where each key works.
sidebar:
  order: 2
---

Press `?` in the review to see the same bindings. For a walkthrough, see [Keyboard review](/guides/keyboard-review/).

## How keys are read

| rule | value |
| --- | --- |
| grammar | `[count] key` or `[count] prefix key`, for example `10j`, `3J`, `gg` |
| chord timeout | 1000 ms between the two keys of a chord (`gg`, `dd`, `zo`) |
| max count | 9999 |
| jump history | 100 entries (`Ctrl+o`, `Ctrl+i`) |
| case | case-sensitive: `j` and `J` are different keys |
| text fields | keys are ignored while focus is in an input or the comment editor |
| behind a dialog | navigation, search, comment and code navigation keys pause |
| behind the read-only viewer | navigation, search, comment and code navigation keys pause, except `Ctrl+o` and `Ctrl+i` |
| holding a key | repeats only `j` `k` `J` `K` `]` `[` `Ctrl+d` `Ctrl+u` |

## Navigation

| key | action | notes |
| --- | --- | --- |
| `j` | next line | takes a count |
| `k` | previous line | takes a count |
| `]` | next hunk | takes a count |
| `[` | previous hunk | takes a count |
| `gg` | first line of the file | chord |
| `G` | last line of the file | with a count, goes to line N: `42G` |
| `Ctrl+d` | half a page down | takes a count |
| `Ctrl+u` | half a page up | takes a count |
| `h` | side-by-side: move to the old side | side-by-side view only |
| `l` | side-by-side: move to the new side | side-by-side view only |
| `Ctrl+o` | jump back | 100-entry history; also steps back out of the read-only viewer |
| `Ctrl+i` | jump forward | |

## Files

| key | action | notes |
| --- | --- | --- |
| `J` | next file | takes a count |
| `K` | previous file | takes a count |
| `gf` | go to the file path on the cursor line | chord |
| `zo` | expand the current file | chord |
| `zc` | collapse the current file | chord |
| `zO` | expand every file | chord |
| `zC` | collapse every file | chord |
| `v` | toggle viewed on the file | |
| `Ctrl+p` | go to a changed file (fuzzy picker) | `Cmd+p` on macOS; a second press closes the picker, even from its input |

## Comments

| key | action | notes |
| --- | --- | --- |
| `c` | comment on the cursor line | |
| `V` | start a visual range | `j` `k` `]` `[` extend it, `Esc` cancels |
| `c` (visual mode) | comment on the range | |
| `C` | comment on the cursor's file | |
| `gv` | reselect the last visual range | chord |
| `e` | edit the comment on the cursor line | |
| `dd` | delete the comment on the cursor line | chord |
| `u` | undo the last comment delete | offered for 8 seconds; otherwise shows `Nothing to undo.` |
| `R` | resolve or reopen that comment | |
| `yy` | copy that comment, or the cursor line when it has none | chord |
| `}` | next comment on the cursor line | |
| `{` | previous comment on the cursor line | |

### In the comment editor

| key | action | notes |
| --- | --- | --- |
| `Ctrl+Enter` | save the comment | `Cmd+Enter` on macOS |
| `Esc` | close the box and keep the draft | the Cancel button discards the draft |
| `Ctrl+G` | suggest change: insert a `suggestion` fence prefilled with the anchored lines | line and range comments only; `Ctrl` on every OS, including macOS |

### In the reply box

| key | action | notes |
| --- | --- | --- |
| `Ctrl+Enter` | send the reply | `Cmd+Enter` on macOS |
| `Esc` | close the reply box | |

## Search

| key | action | notes |
| --- | --- | --- |
| `/` | search the file | smart case: case-insensitive unless the query has an uppercase letter |
| `Enter` (in the search box) | next match, and hand the keys back to the diff | |
| `Shift+Enter` (in the search box) | previous match | |
| `n` | next match | takes a count |
| `N` | previous match | takes a count |
| `g/` | search all changed files | chord; opens the results panel |

### In the `g/` results panel

| key | action | notes |
| --- | --- | --- |
| `ArrowDown` / `ArrowUp` | move through hits | from the query box or the list |
| `j` / `k` | move through hits | list focused only |
| `Enter` | jump to the hit | from the query box, also focuses the list |
| `/` | back to the query box | list focused |

## Code navigation

Needs a language server for the file's language. Keys act on the word the pointer last rested on in the cursor's row, else the row's first identifier.

| key | action | notes |
| --- | --- | --- |
| `gd` | go to definition | on a definition, lists references instead |
| `gy` | go to type definition | |
| `gh` | hover docs for the cursor word | |
| `gA` | list references | grouped by file, changed files first |
| `gs` | symbols in this file | picker |
| `gS` | symbols in the repository | picker |
| `Ctrl+click` | go to definition of the word under the pointer | `Cmd+click` on macOS; holding the modifier shows words as links |
| pointer rest | hover card for the word | |

### In the references panel and the symbol and definition pickers

| key | action | notes |
| --- | --- | --- |
| `ArrowDown` / `ArrowUp` | move | |
| `PageDown` / `PageUp` | move 8 rows | |
| `j` / `k` | move | list focused, not the text input |
| `Enter` | open the selected item | |

### In the read-only viewer

| key | action | notes |
| --- | --- | --- |
| `j` / `ArrowDown` | scroll down 40 px | |
| `k` / `ArrowUp` | scroll up 40 px | |
| `gg` | top | |
| `G` | bottom | |
| `gd` | follow the definition | on the viewed file's own side |
| `gy` | follow the type definition | |
| `Ctrl+o` | step back through viewer hops, then back to the diff | |

## View

| key | action | notes |
| --- | --- | --- |
| `s` | side-by-side / unified | |
| `w` | wrap long lines | |
| `o` | single-file / all files | the default is all files |
| `m` | file list: tree / review order | |
| `t` | light / dark theme | |
| `r` | re-run the diff | |
| `Shift+wheel` | scroll one side-by-side pane horizontally | |

### On the side-by-side divider

| key | action | notes |
| --- | --- | --- |
| `Tab` | focus the divider | |
| `ArrowLeft` / `ArrowRight` | resize by 2% | `Shift` resizes by 10% |
| `Home` / `End` | minimum / maximum width | |
| `Enter` | reset to 50/50 | double-click does the same |

## Panels

| key | action | notes |
| --- | --- | --- |
| `P` | preview review feedback | |
| `gc` | open the review scorecard | chord |
| `gw` | what's new | chord |
| `?` | keyboard help | works in every mode |
| `Esc` | cancel a count or chord, leave the mode, close the overlay | works in every mode; closes one layer per press |

`Esc` closes layers in this order: a pending count or chord, an open dialog, the file picker, the code navigation layers (pending definition, hover card, definition picker, symbols, viewer, references), the `g/` panel, `/` search, then visual mode.

### In overflow menus

| key | action |
| --- | --- |
| `ArrowDown` / `ArrowUp` | move |
| `Home` / `End` | first / last item |
| `Esc` | close |
