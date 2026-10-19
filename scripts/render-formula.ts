#!/usr/bin/env bun
// usage: bun scripts/render-formula.ts <version> <checksums.txt> [out.rb]   (prints to stdout without out)
import { readFileSync, writeFileSync } from "node:fs";
import { renderFormula } from "./distribution/renderFormula";

const [version, checksumsPath, out] = process.argv.slice(2);
if (!version || !checksumsPath) throw new Error("usage: render-formula.ts <version> <checksums.txt> [out.rb]");
const text = renderFormula(version, readFileSync(checksumsPath, "utf8"));
if (out) writeFileSync(out, text);
else process.stdout.write(text);
