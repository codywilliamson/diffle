// persistent provider-result cache. packets are rebuilt from the live diff and never stored.

import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { RadarAnalysis } from "../types";
import { dataDir } from "../core/dataDir";
import type { RadarDraft } from "./units";
import type { RadarProviderConfig } from "./provider";

const CACHE_VERSION = 1;

export function radarCacheKey(drafts: RadarDraft[], config: RadarProviderConfig): string {
  const payload = JSON.stringify({ version: CACHE_VERSION, provider: config.provider, model: config.model,
    threshold: config.attentionThreshold, packets: drafts.map((draft) => draft.packet) });
  return createHash("sha256").update(payload).digest("hex");
}

function pathFor(key: string): string {
  return join(dataDir(), "radar", `${key}.json`);
}

export function readRadarCache(key: string): RadarAnalysis | null {
  try {
    const value = JSON.parse(readFileSync(pathFor(key), "utf8")) as { version?: number; analysis?: RadarAnalysis };
    if (value.version !== CACHE_VERSION || !value.analysis || !Array.isArray(value.analysis.units)) return null;
    const status = value.analysis.status === "partial" ? "partial" : "cached";
    return { ...value.analysis, status, units: value.analysis.units.map((unit) => ({ ...unit, cache: { ...unit.cache, state: unit.providerStatus === "ready" ? "cached" : unit.cache.state } })) };
  } catch {
    return null;
  }
}

export function writeRadarCache(key: string, analysis: RadarAnalysis): void {
  const dir = join(dataDir(), "radar");
  mkdirSync(dir, { recursive: true });
  const target = pathFor(key);
  const temp = join(dir, `${key}.${randomUUID()}.tmp`);
  writeFileSync(temp, JSON.stringify({ version: CACHE_VERSION, analysis }), "utf8");
  renameSync(temp, target);
}
