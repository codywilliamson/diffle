// root component: owns diff + comments + viewed + view prefs, coordinates saves, renders the layout.
import { html, render, useState, useEffect, useMemo, useCallback } from "/preact.js";
import { getDiff, getComments, saveViewed } from "/api.js";
import { useComments } from "/useComments.js";
import { useReviewSync } from "/reviewSync.js";
import { SyncNotice } from "/syncNotice.js";
import { fileAnchorId, clamp } from "/util.js";
import { initTheme, nextTheme } from "/theme.js";
import { usePersistedState } from "/prefs.js";
import { useUpdateCheck } from "/update.js";
import { useAppShortcuts } from "/appShortcuts.js";
import { TopBar } from "/topBar.js";
import { FileTree } from "/fileTree.js";
import { Resizer } from "/resizer.js";
import { DiffView } from "/diffView.js";
import { AppOverlays } from "/appOverlays.js";
import { useWhatsNew } from "/whatsNewModal.js";
import { LoadingScreen } from "/loadingScreen.js";
import { LegacyReviewPrompt } from "/legacyReviewPrompt.js";
import { isRadarDemo, useRadar } from "/radar/useRadar.js";
import { RadarShell } from "/radar/RadarShell.js";

function App() {
  const [diff, setDiff] = useState(null);
  const [viewed, setViewed] = useState([]);
  const [adding, setAdding] = useState(null); // {file, line|null, endLine?} while composing
  const [selecting, setSelecting] = useState(null); // {file, from, to} during a drag-select
  const [showCompile, setShowCompile] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [error, setError] = useState(null);
  const [theme, setTheme] = useState(() => initTheme());
  const [sidebarWidth, setSidebarWidth] = usePersistedState("loupe-sidebar", 280, Number);
  const [splitView, setSplitView] = usePersistedState("loupe-split", false, (v) => v === "true");
  const [wrap, setWrap] = usePersistedState("loupe-wrap", false, (v) => v === "true");
  const [viewMode, setViewMode] = usePersistedState("loupe-view", "all"); // "all" | "single"
  const [activeFile, setActiveFile] = useState(null); // path shown in single-file view
  const [filesOpen, setFilesOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const update = useUpdateCheck();
  const radarDemo = useMemo(isRadarDemo, []);
  const reviewId = new URLSearchParams(location.search).get("review");
  const liveReviewId = radarDemo ? null : reviewId;
  const { record, refreshRecord, notice, dismissNotice } = useReviewSync(liveReviewId);
  const { comments, setComments, onAdd, onEdit, onDelete, onResolve, onReply } = useComments(setError, liveReviewId, refreshRecord, radarDemo);
  const wn = useWhatsNew(update?.current);

  useEffect(() => {
    if (radarDemo) return; // demo mode seeds diff/comments/viewed from the fixture instead
    Promise.all([getDiff(), getComments()])
      .then(([d, review]) => {
        setDiff(d);
        setComments(review.comments);
        setViewed(review.viewed);
      })
      .catch((e) => setError(String(e)));
  }, []);

  // replies, addressed marks, and rereview requests all live on the record's comments.
  useEffect(() => {
    if (record) setComments(record.comments ?? []);
  }, [record]);

  const onToggleViewed = useCallback(
    (path) => {
      const next = viewed.includes(path) ? viewed.filter((p) => p !== path) : [...viewed, path];
      setViewed(next);
      if (!radarDemo) saveViewed(next).catch((e) => setError(String(e)));
    },
    [viewed, radarDemo]
  );

  // selecting tracks the current file in both modes; all-files view also scrolls to it.
  const onSelectFile = useCallback(
    (path, scroll = true) => {
      setActiveFile(path);
      setFilesOpen(false);
      if (scroll && viewMode !== "single")
        document.getElementById(fileAnchorId(path))?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [viewMode]
  );

  // radar demo (?radar-demo=1); a no-op returning {active:false} on ordinary launches.
  const radar = useRadar({ setDiff, setComments, setViewed, onSelectFile });

  const onToggleTheme = useCallback(() => setTheme((t) => nextTheme(t)), []);
  const onToggleSplit = useCallback(() => setSplitView((v) => !v), [setSplitView]);
  const onToggleWrap = useCallback(() => setWrap((w) => !w), [setWrap]);
  const onToggleView = useCallback(() => setViewMode((m) => (m === "single" ? "all" : "single")), [setViewMode]);

  // re-fetch the (server-recomputed) diff in place, preserving comments + open files.
  const onRefresh = useCallback(async () => {
    if (radar.demo) return radar.refresh();
    setRefreshing(true);
    dismissNotice();
    try {
      setDiff(await getDiff());
      if (radar.active) await radar.refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setRefreshing(false);
    }
  }, [dismissNotice, radar.active, radar.demo, radar.refresh]);

  const onResize = useCallback((x) => setSidebarWidth(clamp(x, 180, 640)), [setSidebarWidth]);

  const viewedSet = useMemo(() => new Set(viewed), [viewed]);
  const countsByFile = useMemo(() => {
    const m = new Map();
    for (const c of comments) if (!c.resolved) m.set(c.file, (m.get(c.file) ?? 0) + 1);
    return m;
  }, [comments]);
  const countFor = useCallback((path) => countsByFile.get(path) ?? 0, [countsByFile]);

  useAppShortcuts({
    diff, activeFile, onSelectFile, onToggleViewed, onToggleSplit, onToggleWrap, onToggleView,
    onToggleTheme, onRefresh, wn, setShowCompile, setShowHelp, setAdding, radar,
  });

  if (error) return html`<div class="fatal">${error}</div>`;
  if (!diff) return html`<${LoadingScreen} />`;

  const browse = diff.meta?.mode === "browse";

  return html`<div class="app${browse ? " browse" : ""}">
    <${TopBar}
      refLabel=${diff.ref}
      meta=${diff.meta}
      files=${diff.files}
      theme=${theme}
      refreshing=${refreshing}
      viewMode=${viewMode}
      splitView=${splitView}
      wrap=${wrap}
      update=${update}
      onRefresh=${onRefresh}
      onToggleTheme=${onToggleTheme}
      onToggleView=${onToggleView}
      onToggleSplit=${onToggleSplit}
      onToggleWrap=${onToggleWrap}
      onCompile=${radarDemo ? null : () => setShowCompile(true)}
      previewDisabled=${radarDemo}
      onHelp=${() => setShowHelp(true)}
      onWhatsNew=${wn.reopen}
      reviewId=${liveReviewId}
      record=${record}
      refreshRecord=${refreshRecord}
      comments=${comments}
      onToggleFiles=${() => setFilesOpen((open) => !open)}
    />
    ${!radarDemo && html`<${LegacyReviewPrompt} reviewId=${liveReviewId} onImport=${(imported) => { setComments(imported.comments ?? []); setViewed(imported.viewed ?? []); }} />`}
    ${!radarDemo && html`<${SyncNotice} notice=${notice} onRefresh=${onRefresh} onDismiss=${dismissNotice} />`}
    ${radar.active && html`<${RadarShell} radar=${radar} />`}
    <div class="body">
      <${FileTree}
        files=${diff.files}
        viewedSet=${viewedSet}
        countFor=${countFor}
        activeFile=${activeFile}
        onSelect=${onSelectFile}
        onToggleViewed=${onToggleViewed}
        width=${sidebarWidth}
        browse=${browse}
        radar=${radar.active ? radar : null}
        mobileOpen=${filesOpen}
        onClose=${() => setFilesOpen(false)}
      />
      <${Resizer} onResize=${onResize} />
      <${DiffView}
        files=${diff.files}
        viewMode=${viewMode}
        activeFile=${activeFile}
        splitView=${splitView && !browse}
        browse=${browse}
        wrap=${wrap}
        radar=${radar.diffApi}
        comments=${comments}
        adding=${adding}
        setAdding=${setAdding}
        selecting=${selecting}
        setSelecting=${setSelecting}
        onAdd=${onAdd}
        onEdit=${onEdit}
        onDelete=${onDelete}
        onResolve=${onResolve}
        onReply=${onReply}
      />
    </div>
    <${AppOverlays} showCompile=${showCompile} setShowCompile=${setShowCompile} showHelp=${showHelp}
      setShowHelp=${setShowHelp} wn=${wn} radar=${radar.active} comments=${comments} diff=${diff}
      onEdit=${onEdit} onDelete=${onDelete} onResolve=${onResolve} onReply=${onReply} />
  </div>`;
}

render(html`<${App} />`, document.getElementById("root"));
