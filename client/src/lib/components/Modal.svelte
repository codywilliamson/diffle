<script lang="ts">
  import X from "@lucide/svelte/icons/x";
  import type { Snippet } from "svelte";

  let { title, onClose, children }: { title: string; onClose: () => void; children: Snippet } = $props();

  let dialog = $state<HTMLDivElement>();
  let opener: Element | null = null;

  // focus into the dialog on open; restore focus to the trigger on close.
  $effect(() => {
    opener = document.activeElement;
    dialog?.focus();
    return () => (opener as HTMLElement | null)?.focus?.();
  });

  function focusables(): HTMLElement[] {
    if (!dialog) return [];
    return [...dialog.querySelectorAll<HTMLElement>('a[href],button,textarea,input,select,[tabindex]:not([tabindex="-1"])')].filter(
      (el) => !el.hasAttribute("disabled"),
    );
  }

  // escape closes; tab cycles within the dialog (focus trap).
  function onKeydown(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab") return;
    const list = focusables();
    if (list.length === 0) return;
    const first = list[0]!;
    const last = list[list.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="fixed inset-0 z-50 grid place-items-center p-4">
  <button class="absolute inset-0 bg-black/50" aria-label="Close" tabindex="-1" onclick={onClose}></button>
  <div
    bind:this={dialog}
    class="relative z-10 max-h-[85vh] w-full max-w-lg overflow-auto rounded-lg border border-border bg-surface p-4 shadow-xl"
    role="dialog"
    aria-modal="true"
    aria-label={title}
    tabindex="-1"
  >
    <header class="mb-3 flex items-center">
      <h2 class="font-serif text-lg text-text">{title}</h2>
      <button class="ml-auto rounded p-1 text-muted hover:text-text" aria-label="Close" onclick={onClose}><X size={18} /></button>
    </header>
    {@render children()}
  </div>
</div>
