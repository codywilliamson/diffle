#!/usr/bin/env bun
// usage: bun scripts/render-scoop.ts <version> <checksums.txt> [out.json]   (prints to stdout without out)
import { readFileSync, writeFileSync } from "node:fs";
import { renderScoop } from "./distribution/renderScoop";

const [version, checksumsPath, out] = process.argv.slice(2);
if (!version || !checksumsPath) throw new Error("usage: render-scoop.ts <version> <checksums.txt> [out.json]");
const text = renderScoop(version, readFileSync(checksumsPath, "utf8"));
if (out) writeFileSync(out, text);
else process.stdout.write(text);
