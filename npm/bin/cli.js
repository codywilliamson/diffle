#!/usr/bin/env node
// thin launcher: finds the platform package npm installed next to this one and execs its binary.
// __PACKAGE__ and __INSTALLER_HINT__ are filled in by scripts/stage-npm.ts.
"use strict";

const { spawnSync } = require("node:child_process");
const { join, dirname } = require("node:path");

const PACKAGE = "__PACKAGE__";
const INSTALLER_HINT = __INSTALLER_HINT__;
const SUPPORTED = new Set(["linux-x64", "linux-arm64", "darwin-x64", "darwin-arm64", "win32-x64", "win32-arm64"]);

function fail(message) {
  console.error(`${PACKAGE}: ${message}`);
  process.exit(1);
}

const slug = `${process.platform}-${process.arch}`;
if (!SUPPORTED.has(slug)) {
  fail(`no prebuilt binary for ${slug}. install with the official installer instead: ${INSTALLER_HINT}`);
}

const platformPackage = `${PACKAGE}-${slug}`;
const binaryName = process.platform === "win32" ? `${PACKAGE}.exe` : PACKAGE;
let binary;
try {
  binary = join(dirname(require.resolve(`${platformPackage}/package.json`)), "bin", binaryName);
} catch {
  fail(
    `the ${platformPackage} package is missing (optional dependencies were skipped or the install is incomplete).\n` +
      `reinstall with optional dependencies enabled (npm i -g ${PACKAGE}@latest), or use the installer: ${INSTALLER_HINT}`,
  );
}

const result = spawnSync(binary, process.argv.slice(2), { stdio: "inherit" });
if (result.error) fail(`could not run ${binary}: ${result.error.message}`);
if (result.signal) process.kill(process.pid, result.signal);
process.exit(result.status ?? 1);
