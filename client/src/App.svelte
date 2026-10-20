<script lang="ts">
  import { onMount } from "svelte";
  import { createAppState, setAppState } from "$lib/state/context";
  import TopBar from "$lib/components/TopBar.svelte";
  import Mark from "$lib/components/Mark.svelte";
  import CommitHeader from "$lib/components/CommitHeader.svelte";
  import FileIndex from "$lib/components/FileIndex.svelte";
  import DiffView from "$lib/components/diff/DiffView.svelte";
  import ServerGoneBanner from "$lib/components/ServerGoneBanner.svelte";
  import { onServerLink, setMutationBlock } from "$lib/api/serverLink";
  import SyncNotice from "$lib/components/review/SyncNotice.svelte";
  import LegacyPrompt from "$lib/components/LegacyPrompt.svelte";
  import CursorAnnouncer from "$lib/components/CursorAnnouncer.svelte";
  import SearchResults from "$lib/components/SearchResults.svelte";
  import SearchBar from "$lib/components/SearchBar.svelte";
  import FilePicker from "$lib/components/FilePicker.svelte";
  import HelpOverlay from "$lib/components/HelpOverlay.svelte";
  import WhatsNewModal from "$lib/components/WhatsNewModal.svelte";
  import FeedbackPreview from "$lib/components/review/FeedbackPreview.svelte";
  import { getState } from "$lib/api/meta";
  import { WHATS_NEW } from "$lib/whatsNew";
  import { useKeymap } from "$lib/keymap/useKeymap.svelte";
  import { useCursorReconcile } from "$lib/state/cursorReconcile.svelte";
  import ScorecardPanel from "$lib/components/scorecard/ScorecardPanel.svelte";
  import ReferencesPanel from "$lib/components/lsp/ReferencesPanel.svelte";
  import ReadOnlyFile from "$lib/components/lsp/ReadOnlyFile.svelte";
  import DefinitionPicker from "$lib/components/lsp/DefinitionPicker.svelte";
  import SymbolPicker from "$lib/components/lsp/SymbolPicker.svelte";
  import HoverCard from "$lib/components/lsp/HoverCard.svelte";
  import UndoToast from "$lib/components/UndoToast.svelte";
  import LspToast from "$lib/components/lsp/LspToast.svelte";
  import { lspPointer } from "$lib/lsp/pointer";

  // compose the domain stores once at the root and share them through context.
  const app = setAppState(createAppState());
  const { diff, ui, analysis, comments } = app;

  // re-score whenever a fresh diff lands.
  $effect(() => {
    if (diff.state.status === "ready" && diff.state.diff) void analysis.refresh();
  });

  const { onKeydown, onKeydownCapture } = useKeymap();
  useCursorReconcile();

  onMount(() => {
    void diff.load();
    void app.review.load();
    void app.drafts.load();
    app.review.startPolling();
    // auto-open what's new once per unseen version.
    getState()
      .then((s) => {
        if (s.seenVersion !== WHATS_NEW.version) ui.openOverlay("whatsNew");
      })
      .catch(() => {});
    const unlink = onServerLink((event) => (event === "reachable" ? app.connection.reachable() : app.connection.unreachable()));
    setMutationBlock(() => app.connection.blockedReason);
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) app.connection.verify();
    };
    const onPageHide = () => void app.drafts.flush();
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      app.review.stopPolling();
      unlink();
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("pagehide", onPageHide);
      setMutationBlock(() => null);
      app.connection.dispose();
    };
  });
</script>

<svelte:window onkeydown={onKeydown} onkeydowncapture={onKeydownCapture} />

<main class="flex h-dvh flex-col bg-bg font-sans text-text">
  <ServerGoneBanner />
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
    <SearchBar />
    <SearchResults />
    <ReferencesPanel />
    <div class="relative flex min-h-0 flex-1">
      {#if ui.drawerOpen}
        <button class="fixed inset-0 z-20 bg-black/40 lg:hidden" aria-label="Close file browser" onclick={() => ui.closeDrawer()}></button>
      {/if}
      <FileIndex />
      <div class="relative flex min-w-0 flex-1 flex-col">
        <section data-diff-pane use:lspPointer={app.lsp} data-lsp-old-off={app.lsp.removedSideHint ? "" : undefined} tabindex="-1" class="min-h-0 flex-1 overflow-auto outline-none">
          {#if diff.meta?.commit}<CommitHeader commit={diff.meta.commit} />{/if}
          <DiffView />
        </section>
        <ReadOnlyFile />
      </div>
    </div>
  {:else}
    <div role="status" class="flex flex-1 flex-col items-center justify-center gap-4">
      <Mark size={40} animated />
      <p class="font-mono text-sm text-muted">Loading the diff…</p>
    </div>
  {/if}

  <CursorAnnouncer />
  <HoverCard />
  <DefinitionPicker />
  <SymbolPicker />
  <FilePicker />
  <LspToast />
  <UndoToast />
  {#if ui.activeOverlay === "help"}<HelpOverlay />{/if}
  {#if ui.activeOverlay === "whatsNew"}<WhatsNewModal />{/if}
  {#if ui.activeOverlay === "scorecard" && analysis.scorecard}<ScorecardPanel scorecard={analysis.scorecard} />{/if}
  {#if ui.activeOverlay === "compile"}<FeedbackPreview />{/if}
</main>
