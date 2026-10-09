<script lang="ts">
  import MessageSquarePlus from "@lucide/svelte/icons/message-square-plus";
  import type { CommentTag, DiffFile, DiffLine } from "$types";
  import { getAppState } from "$lib/state/context";
  import type { SplitDisplayRow } from "$lib/diff/splitRows";
  import { markRange, type CharRange } from "$lib/diff/wordDiff";
  import {
    inSavedRange, isPending, rawLine, newComment, selectedRange, type Side,
  } from "$lib/diff/threads";
  import { startSelect } from "$lib/diff/selectDrag";
  import { horizontalWheel } from "$lib/diff/horizontalWheel";
  import { PLAIN_ANNOTATIONS, hunkOfRowKey, type DiffAnnotations } from "$lib/diff/annotations";
  import type { MovedMark } from "$lib/diff/movedLines";
  import MovedMarker from "./MovedMarker.svelte";
  import CommentThread from "../comment/CommentThread.svelte";
  import CommentEditor from "../comment/CommentEditor.svelte";

  interface Props {
    file: DiffFile;
    rows: SplitDisplayRow[];
    side: Side;
    id: string;
    highlighted: (line: DiffLine) => string;
    annotations?: DiffAnnotations;
  }

  let { file, rows, side, id, highlighted, annotations = PLAIN_ANNOTATIONS }: Props = $props();
  const { ui, comments } = getAppState();
  const fileComments = $derived(comments.comments.filter((comment) => comment.file === file.path));

  function keyboardComment(event: MouseEvent, number: number): void {
    if (event.detail !== 0) return;
    if (event.shiftKey) {
      ui.extendAdd(file.path, side, number);
    } else {
      ui.startLineAdd(file.path, side, number);
    }
  }

  function renderCode(line: DiffLine, marks: Map<DiffLine, CharRange>): string {
    const html = highlighted(line);
    const mark = marks.get(line);
    return mark ? markRange(html, mark.start, mark.end, `wd wd-${line.type}`) : html;
  }

  function movedAt(line: DiffLine | null | undefined): MovedMark | null {
    if (!line) return null;
    if (side === "new" && line.type === "addition" && line.newLine != null) return annotations.moved.mark("new", line.newLine);
    if (side === "old" && line.type === "deletion" && line.oldLine != null) return annotations.moved.mark("old", line.oldLine);
    return null;
  }

  async function saveComment(line: DiffLine, text: string, tag?: CommentTag): Promise<string | null> {
    const range = selectedRange(ui.adding, file.path, side);
    if (!range) return "The selected range is no longer available.";
    const comment = newComment({
      file: file.path,
      side,
      ...range,
      lineContent: rawLine(line),
      text,
      tag,
    });
    const error = await comments.add(comment);
    if (!error) ui.cancelAdd();
    return error;
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex (scroll regions need keyboard access) -->
<section
  {id}
  class="split-pane split-pane-{side}"
  aria-label="{side === 'old' ? 'Old' : 'New'} version of {file.path}"
  tabindex="0"
  use:horizontalWheel
>
  <div class="split-label">{side === "old" ? "Old" : "New"}</div>
  {#each rows as row (row.key)}
    {#if row.kind === "header"}
      <div class="split-hunk" title={row.text}>
        {row.text}{#if annotations.whitespaceHunks.has(hunkOfRowKey(row.key))}<span class="ws-label">whitespace only</span>{/if}
      </div>
    {:else if row.kind === "code"}
      {@const line = side === "old" ? row.pair.left : row.pair.right}
      {@const number = (side === "old" ? line?.oldLine : line?.newLine) ?? null}
      {@const moved = movedAt(line)}
      {@const interactive = number != null && !annotations.readonly}
      {@const selected = number != null && isPending(ui.adding, ui.selecting, file.path, side, number)}
      {@const ranged = number != null && inSavedRange(fileComments, side, number)}
      <div
        class="diff-row split-line row-{line?.type ?? 'empty'}"
        class:row-moved={moved}
        class:ws-only={annotations.whitespaceHunks.has(hunkOfRowKey(row.key))}
        class:range-selected={selected}
        class:in-range={ranged}
        data-oldline={side === "old" ? number ?? "" : ""}
        data-newline={side === "new" ? number ?? "" : ""}
      >
        <div class="split-gutter">
          <span class="bubble-gutter">
            {#if interactive}
              <button
                type="button"
                class="bubble-btn"
                aria-label="Comment on {side} line {number}"
                title="Comment — drag or shift-click to select a range"
                onmousedown={(event) => startSelect(event, ui, file.path, side, number)}
                onclick={(event) => keyboardComment(event, number)}
              >
                <MessageSquarePlus size={13} />
              </button>
            {/if}
          </span>
          {#if interactive}
            <button
              type="button"
              class="lineno sel"
              aria-label="Select {side} line {number}"
              onmousedown={(event) => startSelect(event, ui, file.path, side, number)}
              onclick={(event) => keyboardComment(event, number)}
            >{number}</button>
          {:else}
            <span class="lineno">{number ?? ""}</span>
          {/if}
        </div>
        <div class="code code-{line?.type ?? 'empty'}">
          {#if moved?.first}<MovedMarker mark={moved} />{/if}<span class="code-inner">{#if line}{@html renderCode(line, row.marks)}{/if}</span>
        </div>
      </div>
    {:else}
      {@const line = side === "old" ? row.pair.left : row.pair.right}
      {@const list = side === "old" ? row.oldComments : row.newComments}
      {@const adding = side === "old" ? row.oldAdding : row.newAdding}
      <div class="split-comment-slot">
        {#if list.length || adding}
          <div class="comment-box">
            {#if list.length}
              <CommentThread comments={list} />
            {/if}
            {#if adding && line}
              <CommentEditor
                onSave={(text, tag) => saveComment(line, text, tag)}
                onCancel={() => ui.cancelAdd()}
              />
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  {/each}
</section>
