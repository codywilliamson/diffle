<script lang="ts">
  import { untrack } from "svelte";
  import { getAppState } from "$lib/state/context";
  import { fileAnchorId } from "$lib/diff/tree";
  import { useOrderedFiles } from "$lib/state/orderedFiles.svelte";
  import { revealCursor } from "$lib/diff/revealCursor";
  import { FILE_LEVEL } from "$lib/state/cursorSteps";
  import FileSection from "./FileSection.svelte";
  import StaleComments from "../StaleComments.svelte";

  const { diff, ui, prefs, cursor } = getAppState();
  const ordered = useOrderedFiles();

  // in all-files mode, selecting a file scrolls its section into view.
  $effect(() => {
    void ui.scrollRequest;
    const path = untrack(() => ui.activeFile);
    if (prefs.fileView === "single" || !path) return;
    document.getElementById(fileAnchorId(path))?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // the line cursor scrolls itself: instantly, and only when it leaves the margin band.
  $effect(() => {
    if (!cursor.revealSeq) return;
    const pos = untrack(() => cursor.pos);
    if (!pos) return;
    const kind = pos.line === FILE_LEVEL ? "file" : untrack(() => cursor.revealKind);
    return revealCursor({ kind, path: pos.path });
  });

  // single-file mode shows the active file (falling back to the first); all-files shows every file.
  const files = $derived.by(() => {
    if (prefs.fileView === "single") {
      const active = ordered.files.find((f) => f.path === ui.activeFile) ?? ordered.files[0];
      return active ? [active] : [];
    }
    return ordered.files;
  });
</script>

{#if diff.files.length === 0}
  <div class="grid h-full place-items-center p-6 text-sm text-muted">No changes in this diff.</div>
{:else}
  <div data-file-sections class="p-4">
    <StaleComments />
    {#each files as file (file.path)}
      <FileSection {file} />
    {/each}
  </div>
{/if}
