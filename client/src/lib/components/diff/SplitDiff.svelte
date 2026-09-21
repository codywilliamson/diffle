<script lang="ts">
  import MessageSquarePlus from "@lucide/svelte/icons/message-square-plus";
  import type { DiffFile, DiffLine, CommentTag } from "$types";
  import { getAppState } from "$lib/state/context";
  import { highlightLine } from "$lib/diff/highlight";
  import { pairLines, hunkMarks, markRange, type CharRange } from "$lib/diff/wordDiff";
  import { commentsForLine, isPending, isAddingAt, rawLine, newComment, type Side } from "$lib/diff/threads";
  import { startSelect } from "$lib/diff/selectDrag";
  import CommentThread from "../comment/CommentThread.svelte";
  import CommentEditor from "../comment/CommentEditor.svelte";

  let { file }: { file: DiffFile } = $props();
  const { ui, comments, prefs } = getAppState();
  const fileComments = $derived(comments.comments.filter((c) => c.file === file.path));

  // the longest line drives the table width so both panes stay 50/50 and long lines scroll the
  // whole diff (one scrollbar) instead of each cell. 0 while wrapping — lines wrap, no widening.
  const maxCh = $derived.by(() => {
    let m = 1;
    for (const hunk of file.hunks) for (const line of hunk.lines) if (line.content.length > m) m = line.content.length;
    return m;
  });

  function code(line: DiffLine, marks: Map<DiffLine, CharRange>): string {
    const html = highlightLine(line.content, file.path);
    const mark = marks.get(line);
    return mark ? markRange(html, mark.start, mark.end, `wd wd-${line.type}`) : html;
  }
  function saveAdd(side: Side, line: DiffLine, num: number, text: string, tag?: CommentTag): void {
    comments.add(newComment({ file: file.path, side, line: num, endLine: num, lineContent: rawLine(line), text, tag }));
    ui.cancelAdd();
  }
</script>

<table class="diff-table split-table" style="--split-maxch:{prefs.wrap ? 0 : maxCh}">
  <colgroup>
    <col style="width:22px" /><col style="width:52px" /><col />
    <col style="width:22px" /><col style="width:52px" /><col />
  </colgroup>
  {#each file.hunks as hunk, hi (hi)}
    {@const marks = hunkMarks(hunk.lines)}
    {@const rows = pairLines(hunk.lines)}
    <tbody>
      {#if hunk.header}
        <tr class="hunk-header"><td colspan="6">{hunk.header}</td></tr>
      {/if}
      {#each rows as row, ri (ri)}
        {@const left = row.left}
        {@const right = row.right}
        {@const ol = left?.oldLine ?? null}
        {@const nl = right?.newLine ?? null}
        {@const sel = (ol != null && isPending(ui.adding, ui.selecting, file.path, "old", ol)) || (nl != null && isPending(ui.adding, ui.selecting, file.path, "new", nl))}
        <tr class="diff-row split{sel ? ' range-selected' : ''}" data-oldline={ol ?? ""} data-newline={nl ?? ""}>
          <td class="bubble-gutter">
            {#if ol != null}<button class="bubble-btn" aria-label="Comment on old line {ol}" onmousedown={(e) => startSelect(e, ui, file.path, "old", ol)}><MessageSquarePlus size={13} /></button>{/if}
          </td>
          {#if left}
            <td class="lineno" class:sel={ol != null} onmousedown={ol != null ? (e) => startSelect(e, ui, file.path, "old", ol) : undefined}>{left.oldLine ?? ""}</td>
            <td class="code code-{left.type}"><span class="code-inner">{@html code(left, marks)}</span></td>
          {:else}
            <td class="lineno empty"></td><td class="code code-empty"></td>
          {/if}
          <td class="bubble-gutter">
            {#if nl != null}<button class="bubble-btn" aria-label="Comment on new line {nl}" onmousedown={(e) => startSelect(e, ui, file.path, "new", nl)}><MessageSquarePlus size={13} /></button>{/if}
          </td>
          {#if right}
            <td class="lineno" class:sel={nl != null} onmousedown={nl != null ? (e) => startSelect(e, ui, file.path, "new", nl) : undefined}>{right.newLine ?? ""}</td>
            <td class="code code-{right.type}"><span class="code-inner">{@html code(right, marks)}</span></td>
          {:else}
            <td class="lineno empty"></td><td class="code code-empty"></td>
          {/if}
        </tr>
        {#if ol != null && left}
          {@const list = commentsForLine(fileComments, "old", ol)}
          {@const adding = isAddingAt(ui.adding, file.path, "old", ol)}
          {#if list.length > 0 || adding}
            <tr class="comment-row">
              <td class="comment-cell" colspan="3">
                <div class="comment-box">
                  {#if list.length > 0}<CommentThread comments={list} />{/if}
                  {#if adding}<CommentEditor onSave={(text, tag) => saveAdd("old", left, ol, text, tag)} onCancel={() => ui.cancelAdd()} />{/if}
                </div>
              </td>
              <td colspan="3"></td>
            </tr>
          {/if}
        {/if}
        {#if nl != null && right}
          {@const list = commentsForLine(fileComments, "new", nl)}
          {@const adding = isAddingAt(ui.adding, file.path, "new", nl)}
          {#if list.length > 0 || adding}
            <tr class="comment-row">
              <td colspan="3"></td>
              <td class="comment-cell" colspan="3">
                <div class="comment-box">
                  {#if list.length > 0}<CommentThread comments={list} />{/if}
                  {#if adding}<CommentEditor onSave={(text, tag) => saveAdd("new", right, nl, text, tag)} onCancel={() => ui.cancelAdd()} />{/if}
                </div>
              </td>
            </tr>
          {/if}
        {/if}
      {/each}
    </tbody>
  {/each}
</table>
