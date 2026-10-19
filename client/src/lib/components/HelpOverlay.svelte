<script lang="ts">
  import Modal from "./Modal.svelte";
  import { helpGroups } from "$lib/keymap/keymap";
  import { getAppState } from "$lib/state/context";

  const { ui } = getAppState();
  const groups = helpGroups();
</script>

<Modal title="Keyboard shortcuts" wide onClose={() => ui.closeOverlay()}>
  <div class="gap-x-8 text-sm md:columns-2">
    {#each groups as { group, bindings } (group)}
      <section aria-label={group} class="mb-4 break-inside-avoid">
        <h3 class="mb-1.5 font-mono text-xs uppercase tracking-wide text-dim">{group}</h3>
        <dl class="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1.5">
          {#each bindings as b (`${b.mode}:${b.keys}`)}
            <dt class="flex items-center gap-1 whitespace-nowrap">
              <span class="w-6 text-right font-mono text-xs text-dim" title={b.count ? "accepts a count, like 10j" : undefined}>{b.count ? "[n]" : ""}</span>
              <kbd class="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-text">{b.keys}</kbd>
            </dt>
            <dd class="text-muted">{b.label}</dd>
          {/each}
        </dl>
      </section>
    {/each}
    <p class="text-xs text-dim break-inside-avoid">A number before a key repeats it: 10j moves ten lines. A count waits for the next key or Esc. A half-typed g chord is dropped after one second. Ctrl or Cmd plus click on a word goes to its definition; resting the pointer on a word shows its docs.</p>
  </div>
</Modal>
