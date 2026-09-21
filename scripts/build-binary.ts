#!/usr/bin/env bun
// builds the self-contained diffle binary for THIS host: generate the embed entry, then compile.

import { join } from "node:path";
import { PRODUCT } from "../src/core/product";
import { generateStandaloneEntry } from "./generateStandaloneEntry";

const root = join(import.meta.dir, "..");
const { entryFile, version, assetCount } = generateStandaloneEntry(root);

// Bun appends .exe on Windows
const outfile = join(root, "dist", PRODUCT.name);
const compile = Bun.spawnSync(["bun", "build", entryFile, "--compile", "--outfile", outfile], { cwd: root, stdout: "inherit", stderr: "inherit" });
if (compile.exitCode !== 0) throw new Error("bun compile failed");
console.log(`compiled ${outfile} (v${version}, ${assetCount} embedded assets)`);
