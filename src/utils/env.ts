// product env lookup: DIFFLE_<name> preferred, a legacy LOUPE_<name> value honored for one
// minor release. writers should set the DIFFLE_<name> form; readers go through here.

import { PRODUCT } from "../core/product";

export function productEnv(name: string): string | undefined {
  return process.env[PRODUCT.envPrefix + name] ?? process.env[PRODUCT.legacyEnvPrefix + name];
}
