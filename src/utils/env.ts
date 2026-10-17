// product env lookup: NITTLE_<name> preferred, a legacy DIFFLE_<name> value honored for now.
// writers should set the NITTLE_<name> form; readers go through here.

import { PRODUCT } from "../core/product";

export function productEnv(name: string): string | undefined {
  return process.env[PRODUCT.envPrefix + name] ?? process.env[PRODUCT.legacyEnvPrefix + name];
}
