<script lang="ts">
  import type { Snippet } from "svelte";

  // the shell of the centered code-navigation pickers. unlike Modal it does not own Esc: the
  // keymap closes one layer per press. the content decides where focus goes ([data-autofocus]).
  let { title, wide = false, onClose, children }: { title: string; wide?: boolean; onClose: () => void; children: Snippet } = $props();

  let panel = $state<HTMLDivElement>();

  $effect(() => {
    const opener = document.activeElement as HTMLElement | null;
    panel?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return () => {
      if (document.activeElement === document.body || panel?.contains(document.activeElement)) opener?.focus?.();
    };
  });
</script>

<div class="fixed inset-0 z-40 flex items-start justify-center p-4 pt-[12vh]">
  <button class="absolute inset-0 bg-black/40" aria-label="Close" tabindex="-1" onclick={onClose}></button>
  <div
    bind:this={panel}
    role="dialog"
    aria-modal="true"
    aria-label={title}
    tabindex="-1"
    data-lsp-panel
    class="relative z-10 flex max-h-[70dvh] w-full flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-xl outline-none {wide ? 'max-w-2xl' : 'max-w-lg'}"
  >
    {@render children()}
  </div>
</div>
