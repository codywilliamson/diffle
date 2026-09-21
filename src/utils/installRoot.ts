import { basename, dirname, resolve } from "node:path";
import { PRODUCT } from "../core/product";

// true when `executable` is the compiled product binary (current or legacy name), so a
// `diffle`/`diffle-mcp` or a still-installed `loupe`/`loupe-mcp` binary is both recognized.
export function isProductBinary(executable: string): boolean {
  const name = executable.toLowerCase();
  return name.startsWith(PRODUCT.name) || name.startsWith(PRODUCT.legacyName);
}

// Compiled Bun executables use a virtual import.meta.dir; their real install root
// is one directory above the binary folder (dist/ or an MCPB server/ directory).
export function installationRoot(sourceRoot: string): string {
  return isProductBinary(basename(process.execPath)) ? resolve(dirname(process.execPath), "..") : resolve(sourceRoot);
}
