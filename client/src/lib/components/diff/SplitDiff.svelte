<script lang="ts">
  import { untrack } from "svelte";
  import type { DiffFile } from "$types";
  import { getAppState } from "$lib/state/context";
  import { createFileHighlight } from "$lib/diff/fileHighlight.svelte";
  import { splitRows } from "$lib/diff/splitRows";
  import { alignSplitRows } from "$lib/diff/alignSplitRows";
  import { PLAIN_ANNOTATIONS, type DiffAnnotations } from "$lib/diff/annotations";
  import SplitPane from "./SplitPane.svelte";
  import SplitDivider from "./SplitDivider.svelte";
  import type { ExpansionControls } from "$lib/diff/expansion.svelte";

  let { file, annotations = PLAIN_ANNOTATIONS, expansion }: { file: DiffFile; annotations?: DiffAnnotations; expansion?: ExpansionControls } = $props();
  const { comments, prefs, ui, threads } = getAppState();
  const highlighted = createFileHighlight(() => file);
  const id = $props.id();
  let requestedRatio = $state(untrack(() => prefs.splitRatio));
  let effectiveRatio = $state(untrack(() => prefs.splitRatio));
  const rows = $derived(annotations.readonly ? splitRows(file, [], null) : splitRows(file, comments.comments, ui.adding, { collapsed: threads.isCollapsed, views: expansion?.views }));
  $effect(() => {
    requestedRatio = prefs.splitRatio;
  });
</script>

<div class="split-diff" style="--split-ratio:{effectiveRatio}" use:alignSplitRows>
  <SplitPane {file} {rows} side="old" id="{id}-old" {highlighted} {annotations} {expansion} />
  <SplitDivider
    value={requestedRatio}
    controls="{id}-old"
    onResize={(value) => (requestedRatio = value)}
    onEffectiveResize={(value) => (effectiveRatio = value)}
    onCommit={() => prefs.setSplitRatio(requestedRatio)}
  />
  <SplitPane {file} {rows} side="new" id="{id}-new" {highlighted} {annotations} {expansion} />
</div>
