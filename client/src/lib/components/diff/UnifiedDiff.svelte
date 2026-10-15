<script lang="ts">
  import MessageSquarePlus from "@lucide/svelte/icons/message-square-plus";
  import type { DiffFile, DiffLine, CommentTag } from "$types";
  import { getAppState } from "$lib/state/context";
  import { createFileHighlight } from "$lib/diff/fileHighlight.svelte";
  import { hunkMarks, markRange, type CharRange } from "$lib/diff/wordDiff";
  import { commentsForLine, inSavedRange, isPending, isAddingAt, rawLine, newComment, selectedRange, type Side } from "$lib/diff/threads";
  import { startSelect } from "$lib/diff/selectDrag";
  import { PLAIN_ANNOTATIONS, type DiffAnnotations } from "$lib/diff/annotations";
  import type { MovedMark } from "$lib/diff/movedLines";
  import MovedMarker from "./MovedMarker.svelte";
  import CommentThread from "../comment/CommentThread.svelte";
  import CommentEditor from "../comment/CommentEditor.svelte";
  import ThreadPip from "../comment/ThreadPip.svelte";
  import GapExpander from "./GapExpander.svelte";
  import { headerRow, linesLabel } from "$lib/diff/expand";
  import type { ExpansionControls } from "$lib/diff/expansion.svelte";

  let { file, annotations = PLAIN_ANNOTATIONS, expansion }: { file: DiffFile; annotations?: DiffAnnotations; expansion?: ExpansionControls } = $props();
  const { ui, comments, threads } = getAppState();
  const highlighted = createFileHighlight(() => file);

  const SIGN: Record<DiffLine["type"], string> = { addition: "+", deletion: "−", context: " " };
  const fileComments = $derived(comments.comments.filter((c) => c.file === file.path));

  function render(line: DiffLine, marks: Map<DiffLine, CharRange>): string {
    const html = highlighted(line);
    const mark = marks.get(line);
    return mark ? markRange(html, mark.start, mark.end, `wd wd-${line.type}`) : html;
  }

  // additions + context anchor on the new side; deletions anchor on the old side.
  function anchorOf(line: DiffLine): { side: Side; line: number } | null {
    if (line.newLine != null) return { side: "new", line: line.newLine };
    if (line.type === "deletion" && line.oldLine != null) return { side: "old", line: line.oldLine };
    return null;
  }

  function movedAt(line: DiffLine): MovedMark | null {
    if (line.type === "addition" && line.newLine != null) return annotations.moved.mark("new", line.newLine);
    if (line.type === "deletion" && line.oldLine != null) return annotations.moved.mark("old", line.oldLine);
    return null;
  }

  async function saveAdd(side: Side, line: DiffLine, text: string, tag?: CommentTag): Promise<string | null> {
    const range = selectedRange(ui.adding, file.path, side);
    if (!range) return "The selected range is no longer available.";
    const error = await comments.add(newComment({ file: file.path, side, ...range, lineContent: rawLine(line), text, tag }));
    if (!error) ui.cancelAdd();
    return error;
  }
</script>

<table class="diff-table">
  {#each file.hunks as hunk, hi (hi)}
    {@const marks = hunkMarks(hunk.lines)}
    {@const whitespaceOnly = annotations.whitespaceHunks.has(hi)}
    {@const gap = expansion?.views[hi]}
    {@const head = headerRow(gap, hunk.header)}
    <tbody class:ws-only={whitespaceOnly}>
      {#if head.show || whitespaceOnly}
        <tr class="hunk-header"><td colspan="4">{#if expansion && gap && gap.hidden > 0}<GapExpander view={gap} onReveal={(how) => expansion.reveal(hi, how)} />{/if}{head.label}{#if whitespaceOnly}<span class="ws-label">whitespace only</span>{/if}</td></tr>
      {/if}
      {#each hunk.lines as line, li (li)}
        {@const a = annotations.readonly ? null : anchorOf(line)}
        {@const moved = movedAt(line)}
        {@const selected = a ? isPending(ui.adding, ui.selecting, file.path, a.side, a.line) : false}
        {@const ranged = a ? inSavedRange(fileComments, a.side, a.line) : false}
        {@const list = a ? commentsForLine(fileComments, a.side, a.line) : []}
        {@const collapsed = threads.isCollapsed(list)}
        <tr
          class="diff-row row-{line.type}{moved ? ' row-moved' : ''}{selected ? ' range-selected' : ''}{ranged ? ' in-range' : ''}"
          data-oldline={line.oldLine ?? ""}
          data-newline={line.newLine ?? ""}
        >
          <td class="bubble-gutter">
            {#if a}
              <button
                type="button"
                class="bubble-btn"
                title="Comment — drag or shift-click to select a range"
                aria-label="Comment on line {a.line}"
                onmousedown={(e) => startSelect(e, ui, file.path, a.side, a.line)}
              ><MessageSquarePlus size={13} /></button>
            {/if}
          </td>
          <td class="lineno" class:sel={a} onmousedown={a ? (e) => startSelect(e, ui, file.path, a.side, a.line) : undefined}>{line.oldLine ?? ""}</td>
          <td class="lineno" class:sel={a} onmousedown={a ? (e) => startSelect(e, ui, file.path, a.side, a.line) : undefined}>{line.newLine ?? ""}</td>
          <td class="code">{#if collapsed}<ThreadPip comments={list} onExpand={() => threads.setCollapsed(list, false)} />{/if}{#if moved?.first}<MovedMarker mark={moved} />{/if}<span class="sign">{SIGN[line.type]}</span><span class="code-inner">{@html render(line, marks)}</span></td>
        </tr>
        {#if a}
          {@const adding = isAddingAt(ui.adding, file.path, a.side, a.line)}
          {#if (list.length > 0 && !collapsed) || adding}
            <tr class="comment-row">
              <td class="comment-cell" colspan="4">
                <div class="comment-box">
                  {#if list.length > 0 && !collapsed}<CommentThread comments={list} onHide={() => threads.setCollapsed(list, true)} />{/if}
                  {#if adding}
                    <CommentEditor onSave={(text, tag) => saveAdd(a.side, line, text, tag)} onCancel={() => ui.cancelAdd()} />
                  {/if}
                </div>
              </td>
            </tr>
          {/if}
        {/if}
      {/each}
    </tbody>
  {/each}
  {#if expansion}
    {@const tail = expansion.views[file.hunks.length]}
    {#if tail && tail.hidden > 0}
      <tbody>
        <tr class="hunk-header"><td colspan="4"><GapExpander view={tail} onReveal={(how) => expansion.reveal(file.hunks.length, how)} />{linesLabel(tail.hidden, "more")}</td></tr>
      </tbody>
    {/if}
  {/if}
</table>
