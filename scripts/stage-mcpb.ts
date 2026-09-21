// stages the self-contained Loupe binary and a platform-specific MCPB manifest.
// the binary embeds the client, so no separate client tree or package.json is copied here.
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { version: string };
const extension = process.platform === "win32" ? ".exe" : "";
const source = join(root, "dist", `loupe${extension}`);
if (!existsSync(source)) throw new Error(`compiled Loupe binary not found: ${source}`);

const mcpbDir = join(root, "mcpb");
const serverDir = join(mcpbDir, "server");
const binary = `loupe-mcp${extension}`;
// sweep legacy staging outputs so `mcpb pack` never bundles a second client tree.
for (const stale of ["server", "src", "dist", "package.json"]) rmSync(join(mcpbDir, stale), { recursive: true, force: true });
mkdirSync(serverDir, { recursive: true });
copyFileSync(source, join(serverDir, binary));

const manifest = {
  $schema: "https://raw.githubusercontent.com/anthropics/mcpb/main/schemas/mcpb-manifest-v0.4.schema.json",
  manifest_version: "0.4", name: "loupe", display_name: "Loupe Review", version: packageJson.version,
  description: "Review local Git changes and return structured feedback to coding agents.",
  author: { name: "Cody Williamson", url: "https://github.com/codywilliamson" },
  homepage: "https://codywilliamson.github.io/loupe/", repository: { type: "git", url: "https://github.com/codywilliamson/loupe.git" },
  server: { type: "binary", entry_point: `server/${binary}`, mcp_config: { command: `\${__dirname}/server/${binary}`, args: ["mcp", "serve"] } },
  compatibility: { claude_desktop: ">=1.0.0", platforms: [process.platform] },
};
writeFileSync(join(root, "mcpb", "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
