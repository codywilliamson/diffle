// orchestrates local evidence, optional Jev enrichment, and result caching for one live diff.

import type { DiffResult, RadarAnalysis, RadarMeta, RadarPacket, RadarUnit } from "../types";
import { buildRadarDrafts, type RadarDraft } from "./units";
import { applyJev } from "./jev";
import { askJev, providerFromEnv, type RadarProviderConfig, type RetryBudget } from "./provider";
import { radarCacheKey, readRadarCache, writeRadarCache } from "./cache";

const QUESTION_SET = "radar-q1";
const CONCURRENCY = 4;

function meta(config: RadarProviderConfig, units: RadarUnit[]): RadarMeta {
  return { generatedAt: new Date().toISOString(), provider: config.provider, model: config.model,
    questionSet: QUESTION_SET, totalUnits: units.length };
}

async function enrich(drafts: RadarDraft[], config: RadarProviderConfig, fetchFn: typeof fetch): Promise<{ units: RadarUnit[]; errors: string[] }> {
  const units = drafts.map((draft) => draft.unit);
  const errors: string[] = [];
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(new Error("Radar analysis deadline exceeded")), 45_000);
  const retryBudget: RetryBudget = { remaining: 8 };
  let cursor = 0;
  const worker = async () => {
    while (cursor < drafts.length) {
      const index = cursor++;
      const draft = drafts[index] as RadarDraft;
      if (!draft.unit.remote) continue;
      const started = performance.now();
      try {
        const result = await askJev(config, draft.packet, fetchFn, controller.signal, retryBudget);
        units[index] = applyJev(draft.unit, result, config, Math.round(performance.now() - started));
      } catch (error) {
        units[index] = { ...draft.unit, providerStatus: "failed" };
        errors.push(error instanceof Error ? error.message : "Jev analysis failed");
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, drafts.length) }, worker));
  clearTimeout(deadline);
  return { units, errors };
}

export async function analyzeRadar(diff: DiffResult, refresh = false, env: NodeJS.ProcessEnv = process.env, fetchFn: typeof fetch = fetch,
  localOnly = false, contextDiff: DiffResult = diff): Promise<RadarAnalysis> {
  let config: RadarProviderConfig | null;
  try { config = providerFromEnv(env); }
  catch (error) { return { status: "failure", units: [], error: error instanceof Error ? error.message : "Radar configuration failed" }; }
  if (!config) return { status: "off", units: [] };
  const drafts = buildRadarDrafts(diff, config.model, contextDiff);
  const local = drafts.map((draft) => draft.unit);
  if (localOnly || config.provider === "local" || drafts.every((draft) => !draft.unit.remote)) {
    return { status: "ready", meta: meta(config, local), units: local };
  }
  const key = radarCacheKey(drafts, config);
  if (!refresh) {
    const cached = readRadarCache(key);
    if (cached) return cached;
  }
  const { units, errors } = await enrich(drafts, config, fetchFn);
  const successes = units.filter((unit) => unit.providerStatus === "ready").length;
  const analysis: RadarAnalysis = { status: errors.length ? (successes ? "partial" : "failure") : "ready", meta: meta(config, units), units,
    ...(errors.length ? { error: [...new Set(errors)].join("; ") } : {}) };
  if (!errors.length || successes > 0) {
    try { writeRadarCache(key, analysis); } catch { /* cache failure must not discard paid results */ }
  }
  return analysis;
}

export function radarPacket(diff: DiffResult, id: string, env: NodeJS.ProcessEnv = process.env, contextDiff: DiffResult = diff): RadarPacket | null {
  const config = providerFromEnv(env);
  if (!config) return null;
  return buildRadarDrafts(diff, config.model, contextDiff).find((draft) => draft.unit.id === id)?.packet ?? null;
}
