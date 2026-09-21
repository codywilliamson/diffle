<script lang="ts">
  import { getAppState } from "$lib/state/context";
  import { fileAnchorId } from "$lib/diff/tree";
  import FileSection from "./FileSection.svelte";

  const { diff, ui, prefs } = getAppState();

  // in all-files mode, selecting a file scrolls its section into view.
  $effect(() => {
    if (prefs.fileView === "single" || !ui.activeFile) return;
    document.getElementById(fileAnchorId(ui.activeFile))?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // single-file mode shows the active file (falling back to the first); all-files shows every file.
  const files = $derived.by(() => {
    if (prefs.fileView === "single") {
      const active = diff.files.find((f) => f.path === ui.activeFile) ?? diff.files[0];
      return active ? [active] : [];
    }
    return diff.files;
  });
</script>

{#if diff.files.length === 0}
  <div class="grid h-full place-items-center p-6 text-sm text-muted">No changes in this diff.</div>
{:else}
  <div class="p-4">
    {#each files as file (file.path)}
      <FileSection {file} />
    {/each}
  </div>
{/if}
