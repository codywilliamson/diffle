<script lang="ts">
  import MoreHorizontal from "@lucide/svelte/icons/ellipsis";
  import { tick } from "svelte";
  import { clickOutside } from "$lib/actions";
  import { scale } from "$lib/motion";
  import type { FileView } from "$lib/state/prefs.svelte";

  type MenuAction = () => void | Promise<void>;
  interface Props {
    fileView: FileView;
    split: boolean;
    wrap: boolean;
    onRefresh: MenuAction;
    onToggleFileView: MenuAction;
    onToggleSplit: MenuAction;
    onToggleWrap: MenuAction;
    onToggleTheme: MenuAction;
    onWhatsNew: MenuAction;
    onHelp: MenuAction;
  }
  interface MenuItem {
    shortcut: string;
    label: string;
    action: MenuAction;
  }

  let {
    fileView,
    split,
    wrap,
    onRefresh,
    onToggleFileView,
    onToggleSplit,
    onToggleWrap,
    onToggleTheme,
    onWhatsNew,
    onHelp,
  }: Props = $props();

  let open = $state(false);
  let trigger = $state<HTMLButtonElement>();
  let menu = $state<HTMLDivElement>();

  const items = $derived<MenuItem[]>([
    { shortcut: "r", label: "Re-run the diff", action: onRefresh },
    { shortcut: "o", label: fileView === "single" ? "All-files view" : "Single-file view", action: onToggleFileView },
    { shortcut: "s", label: split ? "Unified (all files)" : "Side-by-side (all files)", action: onToggleSplit },
    { shortcut: "w", label: wrap ? "No wrap" : "Wrap lines", action: onToggleWrap },
    { shortcut: "t", label: "Toggle theme", action: onToggleTheme },
    { shortcut: "n", label: "What's new", action: onWhatsNew },
    { shortcut: "?", label: "Keyboard shortcuts", action: onHelp },
  ]);

  function close(): void {
    if (!open) return;
    open = false;
    trigger?.focus();
  }

  async function openMenu(): Promise<void> {
    open = true;
    await tick();
    menu?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
  }

  function choose(item: MenuItem): void {
    void item.action();
    close();
  }

  function onMenuKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;

    const menuItems = [...(menu?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
    if (!menuItems.length) return;
    const activeIndex = menuItems.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === "Home"
        ? menuItems[0]
        : event.key === "End"
          ? menuItems.at(-1)
          : event.key === "ArrowDown"
            ? menuItems[(activeIndex + 1) % menuItems.length]
            : menuItems[activeIndex <= 0 ? menuItems.length - 1 : activeIndex - 1];
    event.preventDefault();
    next?.focus();
  }
</script>

<div class="relative flex items-center min-[701px]:hidden" use:clickOutside={close}>
  <button
    bind:this={trigger}
    type="button"
    class="grid size-11 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-text"
    aria-label="More tools"
    aria-haspopup="menu"
    aria-controls="top-bar-overflow-menu"
    aria-expanded={open}
    title="More tools"
    onclick={() => (open ? close() : openMenu())}
  >
    <MoreHorizontal size={18} />
  </button>

  {#if open}
    <div
      bind:this={menu}
      id="top-bar-overflow-menu"
      role="menu"
      aria-label="More tools"
      tabindex="-1"
      class="absolute right-0 top-full z-50 mt-1 grid min-w-60 gap-px rounded-md border border-border bg-surface p-1 shadow-xl"
      style="transform-origin: top right"
      transition:scale={{ start: 0.96 }}
      onkeydown={onMenuKeydown}
    >
      {#each items as item (item.shortcut)}
        <button
          type="button"
          role="menuitem"
          class="flex min-h-11 items-center justify-between gap-3 rounded px-3 text-left text-sm text-text hover:bg-surface-2 focus:bg-surface-2"
          onclick={() => choose(item)}
        >
          <span>{item.label}</span>
          <kbd class="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted">{item.shortcut}</kbd>
        </button>
      {/each}
    </div>
  {/if}
</div>
