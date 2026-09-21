<script lang="ts">
  import type { DiffFile, DiffLine } from "$types";
  import { highlightLine } from "$lib/diff/highlight";
  import { hunkMarks, markRange, type CharRange } from "$lib/diff/wordDiff";

  let { file }: { file: DiffFile } = $props();

  const SIGN: Record<DiffLine["type"], string> = { addition: "+", deletion: "−", context: " " };

  // highlighted html for a line, with the intra-line word-change range marked.
  function render(line: DiffLine, marks: Map<DiffLine, CharRange>): string {
    const html = highlightLine(line.content, file.path);
    const mark = marks.get(line);
    return mark ? markRange(html, mark.start, mark.end, `wd wd-${line.type}`) : html;
  }
</script>

<table class="diff-table">
  {#each file.hunks as hunk, hi (hi)}
    {@const marks = hunkMarks(hunk.lines)}
    <tbody>
      {#if hunk.header}
        <tr class="hunk-header"><td colspan="3">{hunk.header}</td></tr>
      {/if}
      {#each hunk.lines as line, li (li)}
        <tr class="row-{line.type}" data-oldline={line.oldLine ?? ""} data-newline={line.newLine ?? ""}>
          <td class="lineno">{line.oldLine ?? ""}</td>
          <td class="lineno">{line.newLine ?? ""}</td>
          <td class="code"><span class="sign">{SIGN[line.type]}</span><span class="code-inner">{@html render(line, marks)}</span></td>
        </tr>
      {/each}
    </tbody>
  {/each}
</table>
