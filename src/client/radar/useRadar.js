// Radar integration: demo fixture or live server analysis, plus selection and drawer state.
import { useState, useEffect, useMemo, useCallback, useRef } from "/preact.js";
import { getRadar, getRadarPacket } from "/api.js";
import { fileAnchorId } from "/util.js";
import { RADAR_MODE_EVENT } from "/settingsModel.js";
import { buildMap, markOrder, stepMark, laneCounts, prioritizedUnits, unitState, topUnitForFile, unitCountForFile } from "/radar/model.js";

export const isRadarDemo = () => new URLSearchParams(location.search).get("radar-demo") === "1";
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

function scrollToUnit(unit, generation, token) {
  const attr = unit.side === "old" ? "oldline" : "newline";
  const selector = `#${fileAnchorId(unit.file)} [data-${attr}="${unit.line}"]`;
  let tries = 0;
  const tick = () => {
    if (generation.current !== token) return;
    if (tries === 0) document.getElementById(fileAnchorId(unit.file))?.scrollIntoView({ behavior: "auto", block: "start" });
    const row = document.querySelector(selector);
    if (row) return row.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "center" });
    const load = document.querySelector(`#${fileAnchorId(unit.file)} .giant-note .btn-toggle`);
    if (load && tries === 0) load.click();
    if (tries++ < 120) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const LIVE = {
  analyzing: "Analyzing remote units — deterministic lanes are ready.",
  failure: "Provider unavailable — deterministic lanes retained, retry offered.",
  partial: "Some remote units failed — successful decisions and deterministic lanes are retained.",
  cached: "Radar results restored from cache.",
  stale: "Some units are stale after refresh and await re-analysis.",
  blocker: "Some units were not transmitted — see local blockers.",
  noattention: "Analysis complete — no semantic attention signals; deterministic lanes remain.",
  empty: "No changes to analyze.",
};

export function useRadar({ setDiff, setComments, setViewed, onSelectFile }) {
  const demo = useMemo(isRadarDemo, []);
  const [source, setSource] = useState(null);
  const [status, setStatusRaw] = useState("off");
  const [selectedId, setSelectedId] = useState(null);
  const [drawerState, setDrawerState] = useState(null);
  const mounted = useRef(true);
  const refreshGeneration = useRef(0);
  const navigation = useRef(0);
  const demoTimer = useRef(0);

  useEffect(() => () => {
    mounted.current = false;
    navigation.current = 0;
    clearTimeout(demoTimer.current);
  }, []);

  const loadLive = useCallback(async (refresh = false) => {
    const generation = ++refreshGeneration.current;
    if (refresh) setSource(null);
    try {
      const local = await getRadar({ local: true });
      if (!mounted.current || generation !== refreshGeneration.current) return;
      if (local.status === "off") { setStatusRaw("off"); setSource({ radar: local }); return; }
      setSource({ radar: local });
      if (local.meta?.provider === "local") { setStatusRaw("ready"); return; }
      setStatusRaw("analyzing");
      const complete = await getRadar({ refresh });
      if (!mounted.current || generation !== refreshGeneration.current) return;
      setSource({ radar: complete });
      setStatusRaw(complete.status);
    } catch {
      if (mounted.current && generation === refreshGeneration.current) setStatusRaw("failure");
    }
  }, []);

  useEffect(() => {
    if (demo) import("/radar/fixture.js").then((module) => {
      if (!mounted.current) return;
      setSource(module.RADAR_FIXTURE);
      setStatusRaw("ready");
    });
    else void loadLive(false);
  }, [demo, loadLive]);
  useEffect(() => {
    if (demo) return;
    const reload = () => void loadLive(false);
    window.addEventListener(RADAR_MODE_EVENT, reload);
    return () => window.removeEventListener(RADAR_MODE_EVENT, reload);
  }, [demo, loadLive]);
  useEffect(() => { if (demo && source) { setComments(source.comments); setViewed(source.viewed); } }, [demo, source]);
  useEffect(() => { if (demo && source) setDiff(status === "empty" ? { ...source.diff, files: [] } : source.diff); }, [demo, source, status]);

  const analysis = source?.radar;
  const allUnits = analysis?.units ?? [];
  const filePaths = useMemo(() => (demo ? source?.diff.files ?? [] : []).map((file) => file.path), [demo, source]);
  const effectivePaths = filePaths.length ? filePaths : [...new Set(allUnits.map((unit) => unit.file))];
  const units = useMemo(() => prioritizedUnits(allUnits, status), [allUnits, status]);
  const segments = useMemo(() => buildMap(units, effectivePaths), [units, effectivePaths.join("\0")]);
  const order = useMemo(() => markOrder(segments), [segments]);
  const counts = useMemo(() => laneCounts(units), [units]);
  const unitsByFile = useMemo(() => {
    const map = new Map();
    for (const unit of units) (map.get(unit.file) ?? map.set(unit.file, []).get(unit.file)).push(unit);
    return map;
  }, [units]);

  useEffect(() => {
    if (!order.length) return setSelectedId(null);
    if (!order.includes(selectedId)) setSelectedId(order[0]);
  }, [order, selectedId]);

  const selectUnit = useCallback((id, scroll = true) => {
    const unit = allUnits.find((item) => item.id === id);
    if (!unit) return;
    setSelectedId(id);
    onSelectFile(unit.file, false);
    if (scroll) { const token = ++navigation.current; scrollToUnit(unit, navigation, token); }
  }, [allUnits, onSelectFile]);
  const stepSelection = useCallback((delta) => { const next = stepMark(order, selectedId, delta); if (next) selectUnit(next); }, [order, selectedId, selectUnit]);
  const setStatus = useCallback((value) => { if (demo) setStatusRaw(value); }, [demo]);
  const refresh = useCallback(() => {
    if (!demo) return loadLive(true);
    setStatusRaw("analyzing");
    clearTimeout(demoTimer.current);
    demoTimer.current = setTimeout(() => mounted.current && setStatusRaw("ready"), 800);
    return Promise.resolve();
  }, [demo, loadLive]);

  const openEvidence = useCallback((id, trigger) => setDrawerState({ id, trigger }), []);
  const closeEvidence = useCallback(() => setDrawerState(null), []);
  const drawerUnit = allUnits.find((unit) => unit.id === drawerState?.id);
  const drawer = drawerUnit ? { unit: drawerUnit, trigger: drawerState.trigger } : null;
  const stateFor = useCallback((unit) => unitState(unit, status), [status]);
  const active = demo || (!!analysis && analysis.status !== "off");
  const meta = analysis?.meta ?? { generatedAt: new Date().toISOString(), provider: "local", model: "unavailable", questionSet: "radar-q1", totalUnits: 0 };
  const diffApi = useMemo(() => active ? { selectedId, drawerId: drawer?.unit.id ?? null, unitsByFile, stateFor, selectUnit, openEvidence } : null,
    [active, selectedId, drawer, unitsByFile, stateFor, selectUnit, openEvidence]);

  return { active, demo, ready: !!analysis, status, setStatus, refresh, meta,
    segments, counts, order, units, selectedId, error: analysis?.error,
    liveMessage: status === "failure" && analysis?.error ? `Radar provider failed — ${analysis.error}` : LIVE[status] ?? `Radar ready · ${counts.total} unit${counts.total === 1 ? "" : "s"}.`,
    selectUnit, stepSelection, stateFor, diffApi,
    topUnitForFile: (path) => topUnitForFile(units, path), unitCountForFile: (path) => unitCountForFile(units, path),
    drawer, openEvidence, closeEvidence, packetFor: (id) => demo ? Promise.resolve(allUnits.find((unit) => unit.id === id)?.packet) : getRadarPacket(id) };
}
