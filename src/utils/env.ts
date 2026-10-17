// product env lookup: NITTLE_<name> preferred, a deprecated DIFFLE_<name> value honored as a fallback.
// writers should set the NITTLE_<name> form; readers go through here. LOUPE_* is no longer read.

import { PRODUCT } from "../core/product";

export function productEnv(name: string): string | undefined {
  return process.env[PRODUCT.envPrefix + name] ?? process.env[PRODUCT.legacyEnvPrefix + name];
}

// "DIFFLE_X -> NITTLE_X" for each deprecated var that is actually being used (no NITTLE_ twin set),
// sorted so the list is a stable key.
export function legacyEnvRenames(env: NodeJS.ProcessEnv = process.env): string[] {
  const renames: string[] = [];
  for (const key of Object.keys(env)) {
    if (!key.startsWith(PRODUCT.legacyEnvPrefix) || env[key] === undefined) continue;
    const next = PRODUCT.envPrefix + key.slice(PRODUCT.legacyEnvPrefix.length);
    if (env[next] === undefined) renames.push(`${key} -> ${next}`);
  }
  return renames.sort();
}
