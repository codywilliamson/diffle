// stages the self-contained diffle binary and a platform-specific MCPB manifest.
// no arg → the host binary (dist/diffle[.exe]); a target arg (e.g. "windows-x64") → that target's
// release binary (dist/release/…), so CI can build one MCPB per target. the binary embeds the
// client, so no separate client tree or package.json is copied here.
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PRODUCT } from "../src/core/product";
import { assetName } from "../src/core/updateTarget";

const root = join(import.meta.dir, "..");
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { version: string; license: string };

const target = process.argv[2]; // optional release target, e.g. "windows-x64"
const os = target ? target.split("-")[0] : process.platform === "win32" ? "windows" : process.platform;
const nodePlatform = os === "windows" ? "win32" : os; // manifest compatibility uses node platform ids
const ext = os === "windows" ? ".exe" : "";
const source = target ? join(root, "dist", "release", assetName(target)) : join(root, "dist", `${PRODUCT.name}${ext}`);
if (!existsSync(source)) throw new Error(`compiled ${PRODUCT.displayName} binary not found: ${source}`);

const mcpbDir = join(root, "mcpb");
const serverDir = join(mcpbDir, "server");
const binary = `${PRODUCT.name}-mcp${ext}`;
// sweep legacy staging outputs so `mcpb pack` never bundles a second client tree or old binary.
for (const stale of ["server", "src", "dist", "package.json"]) rmSync(join(mcpbDir, stale), { recursive: true, force: true });
mkdirSync(serverDir, { recursive: true });
copyFileSync(source, join(serverDir, binary));

const manifest = {
  $schema: "https://raw.githubusercontent.com/anthropics/mcpb/main/schemas/mcpb-manifest-v0.4.schema.json",
  manifest_version: "0.4", name: PRODUCT.name, display_name: PRODUCT.displayName, version: packageJson.version,
  description: "Review local Git changes and return structured feedback to coding agents.",
  author: { name: PRODUCT.author.name, url: PRODUCT.author.url },
  license: packageJson.license,
  homepage: PRODUCT.site,
  icon: "icon.png",
  repository: { type: "git", url: `${PRODUCT.repository}.git` },
  server: { type: "binary", entry_point: `server/${binary}`, mcp_config: { command: `\${__dirname}/server/${binary}`, args: ["mcp", "serve"] } },
  compatibility: { claude_desktop: ">=1.0.0", platforms: [nodePlatform] },
};
writeFileSync(join(root, "mcpb", "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
