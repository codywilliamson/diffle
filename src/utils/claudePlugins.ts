// pure detection of a stale legacy claude code plugin install. claude's json registry is read
// read-only; every read tolerates a missing file, bad json, or an unexpected shape.

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { isLegacyRepo } from "../core/marketplaceState";
import { PRODUCT, repositorySlug } from "../core/product";
import { isRetiredCommand } from "../core/migration/retiredCommand";

export interface InstalledPlugin { key: string; name: string; marketplace: string; version: string; installPath: string; }
export interface LegacyMcpServer { plugin: string; server: string; }

export interface ClaudePluginState {
  configDir: string;
  legacy: InstalledPlugin[];
  legacyEnabled: string[];
  legacyMarketplaces: string[];
  staleSlug: boolean; // our marketplace is still registered under the pre-rename repo slug
  legacyMcpServers: LegacyMcpServer[];
  product: InstalledPlugin[];
  productEnabled: string[];
  unreadable: string[];
}

export type CheckLevel = "ok" | "warn" | "fail" | "info";
export interface Check { level: CheckLevel; label: string; detail: string; }
export interface RepairStep { args: string[]; describe: string; }
export interface Diagnosis { checks: Check[]; plan: RepairStep[]; ok: boolean; }

type Json = Record<string, unknown>;

const str = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);
const asObject = (value: unknown): Json | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : undefined;

// `${pluginName}@${marketplace}`, plus the companion `-hook` plugin
const keyPattern = (pluginNames: readonly string[]) => new RegExp(`^((?:${pluginNames.join("|")})(?:-hook)?)@(.+)$`);

const RETIRED_PLUGIN_NAMES: string[] = PRODUCT.retiredPlugins.map((plugin) => plugin.name);
const RETIRED_MARKETPLACES: string[] = PRODUCT.retiredPlugins.map((plugin) => plugin.marketplace);

export function claudeConfigDir(): string {
  return process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude");
}

function readJson(path: string, unreadable: string[]): Json | undefined {
  try {
    const parsed = asObject(JSON.parse(readFileSync(path, "utf8")));
    if (!parsed) throw new Error("not an object");
    return parsed;
  } catch {
    unreadable.push(path);
    return undefined;
  }
}

// a registry value is normally an array of installs; tolerate a bare object too.
function installs(value: unknown): Json[] {
  return (Array.isArray(value) ? value : [value]).map(asObject).filter((v): v is Json => v !== undefined);
}

function collect(plugins: Json | undefined, pluginNames: readonly string[]): InstalledPlugin[] {
  const pattern = keyPattern(pluginNames);
  const found: InstalledPlugin[] = [];
  for (const [key, value] of Object.entries(plugins ?? {})) {
    const match = pattern.exec(key);
    if (!match) continue;
    for (const entry of installs(value)) {
      found.push({
        key, name: match[1]!, marketplace: match[2]!,
        version: str(entry.version) ?? "unknown", installPath: str(entry.installPath) ?? "",
      });
    }
  }
  return found;
}

function enabledMatching(settings: Json | undefined, pluginNames: readonly string[]): string[] {
  const enabled = asObject(settings?.enabledPlugins) ?? {};
  const pattern = keyPattern(pluginNames);
  return Object.entries(enabled).filter(([key, on]) => on === true && pattern.test(key)).map(([key]) => key);
}

// a marketplace is legacy when it carries the old name or points at the old repo. the current
// marketplace is never legacy here; an old-slug registration of it is reported as staleSlug.
function legacyMarketplaces(known: Json | undefined, settings: Json | undefined): string[] {
  const extra = asObject(settings?.extraKnownMarketplaces) ?? {};
  const names = new Set<string>();
  for (const [name, entry] of [...Object.entries(known ?? {}), ...Object.entries(extra)]) {
    const repo = str(asObject(asObject(entry)?.source)?.repo) ?? "";
    if (name === PRODUCT.plugin.marketplace) continue;
    if (RETIRED_MARKETPLACES.includes(name) || repo.endsWith(`/${PRODUCT.legacyName}`)) names.add(name);
  }
  return [...names];
}

// the cached plugin's own .mcp.json still launches the old command
function legacyMcpServers(legacy: InstalledPlugin[]): LegacyMcpServer[] {
  const found: LegacyMcpServer[] = [];
  for (const plugin of legacy) {
    if (!plugin.installPath) continue;
    let servers: Json | undefined;
    try { servers = asObject(asObject(JSON.parse(readFileSync(join(plugin.installPath, ".mcp.json"), "utf8")))?.mcpServers); }
    catch { continue; }
    for (const [server, config] of Object.entries(servers ?? {})) {
      if (isRetiredCommand(str(asObject(config)?.command))) found.push({ plugin: plugin.key, server });
    }
  }
  return found;
}

export function readClaudePluginState(configDir = claudeConfigDir()): ClaudePluginState {
  const unreadable: string[] = [];
  const installed = readJson(join(configDir, "plugins", "installed_plugins.json"), unreadable);
  const known = readJson(join(configDir, "plugins", "known_marketplaces.json"), unreadable);
  const settings = readJson(join(configDir, "settings.json"), unreadable);
  const plugins = asObject(installed?.plugins);
  const legacy = collect(plugins, RETIRED_PLUGIN_NAMES);
  return {
    configDir, legacy,
    legacyEnabled: enabledMatching(settings, RETIRED_PLUGIN_NAMES),
    legacyMarketplaces: legacyMarketplaces(known, settings),
    staleSlug: [known?.[PRODUCT.plugin.marketplace], asObject(settings?.extraKnownMarketplaces)?.[PRODUCT.plugin.marketplace]].some((entry) => isLegacyRepo(str(asObject(asObject(entry)?.source)?.repo) ?? "")),
    legacyMcpServers: legacyMcpServers(legacy),
    product: collect(plugins, [PRODUCT.plugin.name]),
    productEnabled: enabledMatching(settings, [PRODUCT.plugin.name]),
    unreadable,
  };
}

// the condition behind the one-line startup hint: legacy leftovers with no replacement installed.
export function hasStaleLegacyPlugin(state: ClaudePluginState): boolean {
  return state.product.length === 0 &&
    (state.legacy.length > 0 || state.legacyEnabled.length > 0 || state.legacyMcpServers.length > 0);
}

function uniqueKeys(plugins: InstalledPlugin[]): string[] {
  return [...new Set(plugins.map((plugin) => plugin.key))];
}

function buildPlan(state: ClaudePluginState): RepairStep[] {
  // install first: a failed install must leave the retired plugin in place (callers stop at the first failure)
  const steps: RepairStep[] = [];
  if (state.product.length === 0 || state.staleSlug) {
    const plugin = `${PRODUCT.plugin.name}@${PRODUCT.plugin.marketplace}`;
    if (state.staleSlug) steps.push({ args: ["plugin", "marketplace", "remove", PRODUCT.plugin.marketplace], describe: "drop the marketplace registered at the old repo slug" });
    steps.push({ args: ["plugin", "marketplace", "add", repositorySlug()], describe: `register the ${PRODUCT.name} marketplace` });
    steps.push({ args: ["plugin", "install", plugin, "--scope", "user"], describe: `install ${plugin}` });
  }
  for (const key of uniqueKeys(state.legacy)) {
    steps.push({ args: ["plugin", "uninstall", key], describe: `remove the legacy ${key} plugin` });
  }
  for (const marketplace of state.legacyMarketplaces) {
    steps.push({ args: ["plugin", "marketplace", "remove", marketplace], describe: `unregister the ${marketplace} marketplace` });
  }
  return steps;
}

const list = (plugins: InstalledPlugin[]) => plugins.map((p) => `${p.key} v${p.version}`).join(", ");

// checks + repair plan. `productPath`/`legacyPath` are Bun.which() results, passed in so this
// stays pure; `legacyDataDir` reports the legacy data dir fallback (info only).
export function diagnoseClaudePlugins(
  state: ClaudePluginState, productPath?: string, legacyPath?: string, legacyDataDir = false,
): Diagnosis {
  const replaced = state.product.length > 0;
  // legacy leftovers only fail while nothing has replaced them
  const level: CheckLevel = replaced ? "warn" : "fail";
  const checks: Check[] = [
    state.legacy.length > 0
      ? { level, label: "legacy plugins", detail: list(state.legacy) }
      : { level: "ok", label: "legacy plugins", detail: `no ${RETIRED_PLUGIN_NAMES.join(" / ")} plugin installed` },
    state.legacyEnabled.length > 0
      ? { level, label: "legacy plugin enabled", detail: state.legacyEnabled.join(", ") }
      : { level: "ok", label: "legacy plugin enabled", detail: "none enabled" },
    state.legacyMarketplaces.length > 0
      ? { level: "warn", label: "legacy marketplace", detail: `${state.legacyMarketplaces.join(", ")} still registered` }
      : { level: "ok", label: "legacy marketplace", detail: "none registered" },
    state.staleSlug
      ? { level: "warn", label: "marketplace source", detail: `${PRODUCT.plugin.marketplace} still points at ${PRODUCT.legacyRepository}; repair re-registers it at ${repositorySlug()}` }
      : { level: "ok", label: "marketplace source", detail: "not on the old repo slug" },
    state.legacyMcpServers.length > 0
      ? { level, label: "legacy MCP server", detail: state.legacyMcpServers.map((s) => `${s.server} (${s.plugin}) runs \`${PRODUCT.legacyName}\``).join(", ") }
      : { level: "ok", label: "legacy MCP server", detail: `no \`${PRODUCT.legacyName}\` server wired` },
    !replaced
      ? { level: "warn", label: `${PRODUCT.plugin.name}`, detail: "not installed" }
      : state.productEnabled.length === 0
        ? { level: "warn", label: `${PRODUCT.plugin.name}`, detail: `${list(state.product)} installed but not enabled` }
        : { level: "ok", label: `${PRODUCT.plugin.name}`, detail: `${list(state.product)} installed and enabled` },
    productPath
      ? { level: "ok", label: `\`${PRODUCT.name}\` on PATH`, detail: productPath }
      : { level: "warn", label: `\`${PRODUCT.name}\` on PATH`, detail: `not found — re-run the installer (${PRODUCT.site}/install) or \`${PRODUCT.name} update\`` },
  ];
  if (legacyPath) checks.push({ level: "info", label: `\`${PRODUCT.legacyName}\` on PATH`, detail: legacyPath });
  if (legacyDataDir) checks.push({ level: "info", label: "data dir", detail: `using the legacy ~/${PRODUCT.legacyDataDir} directory (still supported)` });
  for (const path of state.unreadable) checks.push({ level: "info", label: "config", detail: `could not read ${path}` });
  return { checks, plan: buildPlan(state), ok: !checks.some((check) => check.level === "fail") };
}
