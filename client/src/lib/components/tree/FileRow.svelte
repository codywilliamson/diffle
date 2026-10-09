<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import NumberFlow from "@number-flow/svelte";
  import { fileAnchorId, type TreeFile } from "$lib/diff/tree";
  import { getAppState } from "$lib/state/context";
  import { changeBadge } from "$lib/format";
  import { worstFlagBand, BAND_DOT, BAND_LABEL } from "$lib/scorecard/bands";
  import { morphInto } from "$lib/viewTransition";

  let { file, depth = 0, review = false }: { file: TreeFile; depth?: number; review?: boolean } = $props();
  const { ui, comments, prefs, analysis } = getAppState();

  const leaf = $derived(file.path.slice(file.path.lastIndexOf("/") + 1));
  const dir = $derived(file.path.slice(0, Math.max(0, file.path.length - leaf.length - 1)));
  const info = $derived(review ? analysis.fileFor(file.path) : undefined);
  const flagBand = $derived(info ? worstFlagBand(info.flags) : null);

  const badge = $derived(changeBadge(file.changeType));
  const active = $derived(ui.activeFile === file.path);
  const viewed = $derived(comments.viewedSet.has(file.path));
  const count = $derived(comments.countFor(file.path));

  // single-file mode swaps the diff, so the row morphs into its file header; all-files mode just scrolls.
  function select(e: MouseEvent & { currentTarget: HTMLElement }): void {
    if (prefs.fileView !== "single" || active) return ui.selectFile(file.path);
    morphInto(e.currentTarget, () => ui.selectFile(file.path), () =>
      document.getElementById(fileAnchorId(file.path))?.querySelector<HTMLElement>("[data-file-header]") ?? null,
    );
  }
</script>

<div class="flex items-center gap-1 pr-1.5" style="padding-left: {depth * 12 + 6}px">
  <button
    type="button"
    class="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-surface-2 {active ? 'bg-surface-2 text-text' : 'text-muted'}"
    aria-current={active ? "true" : undefined}
    onclick={select}
  >
    <span class="grid size-4 shrink-0 place-items-center rounded font-mono text-[10px] font-semibold {badge.cls}" title={badge.label}>{badge.letter}</span>
    <span class="font-mono {review ? 'max-w-[70%] shrink-0' : ''} truncate {info?.noise ? 'opacity-60' : ''}" title={review ? file.path : undefined}>{review ? leaf : file.name}</span>
    {#if review && dir}<span class="min-w-0 truncate font-mono text-[11px] text-dim {info?.noise ? 'opacity-60' : ''}">{dir}</span>{/if}
    {#if flagBand}
      <span class="size-1.5 shrink-0 rounded-full {BAND_DOT[flagBand]}" role="img" aria-label="{BAND_LABEL[flagBand]} risk flag" title="{BAND_LABEL[flagBand]} risk flag"></span>
    {/if}
    {#if info?.isTest}
      <span class="shrink-0 rounded bg-surface-2 px-1 font-mono text-[9px] uppercase tracking-wide text-dim">test</span>
    {/if}
    <span class="ml-auto flex shrink-0 items-center gap-1.5">
      {#if count > 0}
        <span class="rounded-full bg-surface-2 px-1.5 font-mono text-[10px] text-accent" title="{count} unresolved"><NumberFlow value={count} /></span>
      {/if}
      {#if !file.binary && (file.additions || file.deletions)}
        <span class="font-mono text-[10px]">
          {#if file.additions}<span class="text-add-text">+{file.additions}</span>{/if}
          {#if file.deletions}<span class="text-del-text"> −{file.deletions}</span>{/if}
        </span>
      {/if}
    </span>
  </button>
  <label class="shrink-0 cursor-pointer rounded p-1 {viewed ? 'text-add-text' : 'text-dim hover:text-muted'}" title={viewed ? "Viewed" : "Mark viewed"}>
    <input type="checkbox" class="sr-only" checked={viewed} onchange={() => comments.toggleViewed(file.path)} aria-label="Mark {file.path} viewed" />
    <Check size={14} />
  </label>
</div>
