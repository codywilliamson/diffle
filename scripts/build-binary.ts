#!/usr/bin/env bun
// builds the self-contained nittle binary for THIS host: generate the embed entry, then compile.

import { join } from "node:path";
import { PRODUCT } from "../src/core/product";
import { COMPILE_FLAGS } from "./compileFlags";
import { generateStandaloneEntry, WORKER_ENTRY_FILES } from "./generateStandaloneEntry";

const root = join(import.meta.dir, "..");
const { entryFile, version, assetCount } = generateStandaloneEntry(root);

// Bun appends .exe on Windows
const outfile = join(root, "dist", PRODUCT.name);
const compile = Bun.spawnSync(["bun", "build", entryFile, ...WORKER_ENTRY_FILES, ...COMPILE_FLAGS, "--outfile", outfile], { cwd: root, stdout: "inherit", stderr: "inherit" });
if (compile.exitCode !== 0) throw new Error("bun compile failed");
console.log(`compiled ${outfile} (v${version}, ${assetCount} embedded assets)`);
