<script lang="ts">
  import { onMount } from "svelte";
  import { createAppState, setAppState } from "$lib/state/context";
  import TopBar from "$lib/components/TopBar.svelte";
  import Mark from "$lib/components/Mark.svelte";
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
  import ScorecardPanel from "$lib/components/scorecard/ScorecardPanel.svelte";
  import { useOrderedFiles } from "$lib/state/orderedFiles.svelte";
  import { currentFile } from "$lib/diff/currentFile";

  // compose the domain stores once at the root and share them through context.
  const app = setAppState(createAppState());
  const { diff, ui, prefs, comments, analysis } = app;

  const ordered = useOrderedFiles();

  // re-score whenever a fresh diff lands.
  $effect(() => {
    if (diff.state.status === "ready" && diff.state.diff) void analysis.refresh();
  });

  // right after any selection (j/k or the sidebar) the pane is still smooth-scrolling to it, so
  // trust the selection over the scroll position.
  const SMOOTH_SCROLL_MS = 600;
  let lastSelectAt = -Infinity;
  $effect(() => {
    if (ui.activeFile) lastSelectAt = performance.now();
  });

  // global shortcuts, ignored while typing in a field.
  function onKeydown(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      ui.closeOverlay();
      return;
    }
    if (isEditable(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    const paths = ordered.files.map((file) => file.path);
    const followScroll = prefs.fileView === "all" && performance.now() - lastSelectAt > SMOOTH_SCROLL_MS;
    const current = followScroll ? currentFile(paths, ui.activeFile) : ui.activeFile ?? paths[0];
    const index = paths.indexOf(current ?? "");
    const stepFile = (delta: number): void => {
      const next = paths[Math.min(paths.length - 1, Math.max(0, index + delta))];
      if (next) ui.selectFile(next);
    };
    switch (e.key) {
      case "j": stepFile(1); break;
      case "k": stepFile(-1); break;
      case "v": if (current) void comments.toggleViewed(current); break;
      case "t": prefs.toggleTheme(); break;
      case "s": prefs.toggleSplit(); break;
      case "w": prefs.toggleWrap(); break;
      case "o": prefs.setFileView(prefs.fileView === "single" ? "all" : "single"); break;
      case "r": void diff.refresh(); break;
      case "g": if (analysis.scorecard) ui.toggleOverlay("scorecard"); break;
      case "m": prefs.setFileOrder(prefs.fileOrder === "review" ? "tree" : "review"); break;
      case "c": ui.openOverlay("compile"); break;
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
    {#if comments.error}
      <p role="alert" class="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">{comments.error}</p>
    {/if}
    <div class="relative flex min-h-0 flex-1">
      {#if ui.drawerOpen}
        <button class="fixed inset-0 z-20 bg-black/40 lg:hidden" aria-label="Close file browser" onclick={() => ui.closeDrawer()}></button>
      {/if}
      <FileIndex />
      <section data-diff-pane class="min-w-0 flex-1 overflow-auto">
        <DiffView />
      </section>
    </div>
  {:else}
    <div role="status" class="flex flex-1 flex-col items-center justify-center gap-4">
      <Mark size={40} animated />
      <p class="font-mono text-sm text-muted">Loading the diff…</p>
    </div>
  {/if}

  {#if ui.activeOverlay === "help"}<HelpOverlay />{/if}
  {#if ui.activeOverlay === "whatsNew"}<WhatsNewModal />{/if}
  {#if ui.activeOverlay === "scorecard" && analysis.scorecard}<ScorecardPanel scorecard={analysis.scorecard} />{/if}
  {#if ui.activeOverlay === "compile"}<FeedbackPreview />{/if}
</main>
