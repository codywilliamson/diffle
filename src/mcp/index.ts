#!/usr/bin/env -S bun --no-env-file
import { join } from "node:path";
import { createReviewOperations } from "./reviewOperations";
import { configuredRoots, serveMcp } from "./stdio";
import { currentVersion } from "../core/updateCheck";
import { installationRoot } from "../utils/installRoot";

export async function runMcpServer(cwd = process.cwd()): Promise<void> {
  const productRoot = installationRoot(join(import.meta.dir, "..", ".."));
  await serveMcp(createReviewOperations(productRoot), configuredRoots(cwd), currentVersion(productRoot));
}

if (import.meta.main) await runMcpServer();
