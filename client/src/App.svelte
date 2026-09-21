<script lang="ts">
  import { onMount } from "svelte";
  import { createAppState, setAppState } from "$lib/state/context";
  import TopBar from "$lib/components/TopBar.svelte";
  import FileIndex from "$lib/components/FileIndex.svelte";
  import DiffView from "$lib/components/diff/DiffView.svelte";
  import SyncNotice from "$lib/components/review/SyncNotice.svelte";
  import LegacyPrompt from "$lib/components/LegacyPrompt.svelte";
  import HelpOverlay from "$lib/components/HelpOverlay.svelte";
  import WhatsNewModal from "$lib/components/WhatsNewModal.svelte";
  import FeedbackPreview from "$lib/components/review/FeedbackPreview.svelte";
  import { getState } from "$lib/api/meta";
  import { WHATS_NEW } from "$lib/whatsNew";
  import { isEditable } from "$lib/shortcuts";

  // compose the five domain stores once at the root and share them through context.
  const app = setAppState(createAppState());
  const { diff, ui, prefs } = app;

  // global shortcuts, ignored while typing in a field.
  function onKeydown(e: KeyboardEvent): void {
    if (isEditable(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    switch (e.key) {
      case "t": prefs.toggleTheme(); break;
      case "s": prefs.toggleSplit(); break;
      case "w": prefs.toggleWrap(); break;
      case "o": prefs.setFileView(prefs.fileView === "single" ? "all" : "single"); break;
      case "r": void diff.refresh(); break;
      case "n": ui.toggleOverlay("whatsNew"); break;
      case "?": ui.toggleOverlay("help"); break;
      default: return;
    }
    e.preventDefault();
  }

  onMount(() => {
    void diff.load();
    void app.review.load();
    app.review.startPolling();
    // auto-open what's new once per unseen version.
    getState()
      .then((s) => {
        if (s.seenVersion !== WHATS_NEW.version) ui.openOverlay("whatsNew");
      })
      .catch(() => {});
    return () => app.review.stopPolling();
  });
</script>

<svelte:window onkeydown={onKeydown} />

<main class="flex h-dvh flex-col bg-bg font-sans text-text">
  {#if diff.state.status === "error"}
    <p role="alert" class="m-6 rounded-md border border-border bg-surface p-4 text-destructive">
      {diff.state.message}
    </p>
  {:else if diff.state.status === "ready"}
    <TopBar />
    <SyncNotice />
    <LegacyPrompt />
    <div class="relative flex min-h-0 flex-1">
      {#if ui.drawerOpen}
        <button class="fixed inset-0 z-20 bg-black/40 lg:hidden" aria-label="Close file browser" onclick={() => ui.closeDrawer()}></button>
      {/if}
      <FileIndex />
      <section class="min-w-0 flex-1 overflow-auto">
        <DiffView />
      </section>
    </div>
  {:else}
    <p role="status" class="p-6 font-mono text-sm text-muted">Loading the diff…</p>
  {/if}

  {#if ui.activeOverlay === "help"}<HelpOverlay />{/if}
  {#if ui.activeOverlay === "whatsNew"}<WhatsNewModal />{/if}
  {#if ui.activeOverlay === "compile"}<FeedbackPreview />{/if}
</main>
