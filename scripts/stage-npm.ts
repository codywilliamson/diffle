#!/usr/bin/env bun
// renders the main npm package and one package per platform from release assets into a staging dir.
// usage: bun scripts/stage-npm.ts --version 1.2.3 --assets dist/release --out dist/npm [--targets linux-x64,windows-x64]
// every target in the release must have its binary in --assets unless --targets narrows the set (dry runs and per-runner smokes).

import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { NPM_MAIN_PACKAGE, NPM_PLATFORMS, npmPlatformPackage } from "../src/core/npmPackage";
import { PRODUCT } from "../src/core/product";
import { assetName } from "../src/core/updateTarget";
import { json, mainPackageJson, platformPackageJson, renderShim } from "./distribution/renderNpm";

const root = join(import.meta.dir, "..");
const { values } = parseArgs({
  options: { version: { type: "string" }, assets: { type: "string" }, out: { type: "string" }, targets: { type: "string" } },
});
if (!values.version || !values.assets || !values.out) throw new Error("usage: stage-npm.ts --version X --assets DIR --out DIR [--targets a,b]");

const wanted = values.targets ? values.targets.split(",") : NPM_PLATFORMS.map((p) => p.releaseTarget);
rmSync(values.out, { recursive: true, force: true });

for (const p of NPM_PLATFORMS.filter((x) => wanted.includes(x.releaseTarget))) {
  const source = join(values.assets, assetName(p.releaseTarget));
  if (!existsSync(source)) throw new Error(`missing release asset ${source}`);
  const dir = join(values.out, npmPlatformPackage(p));
  const binary = join(dir, "bin", p.os === "win32" ? `${PRODUCT.name}.exe` : PRODUCT.name);
  mkdirSync(join(dir, "bin"), { recursive: true });
  copyFileSync(source, binary);
  chmodSync(binary, 0o755);
  writeFileSync(join(dir, "package.json"), json(platformPackageJson(p, values.version)));
  console.log(`staged ${npmPlatformPackage(p)}`);
}

const main = join(values.out, NPM_MAIN_PACKAGE);
mkdirSync(join(main, "bin"), { recursive: true });
writeFileSync(join(main, "bin", "cli.js"), renderShim(readFileSync(join(root, "npm", "bin", "cli.js"), "utf8")));
copyFileSync(join(root, "npm", "README.md"), join(main, "README.md"));
copyFileSync(join(root, "LICENSE"), join(main, "LICENSE"));
writeFileSync(join(main, "package.json"), json(mainPackageJson(values.version)));
console.log(`staged ${NPM_MAIN_PACKAGE} -> ${values.out}`);
