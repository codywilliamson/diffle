import { basename, dirname, resolve } from "node:path";
import { PRODUCT } from "../core/product";

// true when `executable` is the compiled product binary. the legacy name is kept on purpose:
// the transition release asset `diffle-<os>-<arch>` is the nittle binary under its old name and
// must still be able to run `update`.
export function isProductBinary(executable: string): boolean {
  const name = executable.toLowerCase();
  return name.startsWith(PRODUCT.name) || name.startsWith(PRODUCT.legacyName);
}

// true for the transition asset: the nittle binary still carrying its old diffle name.
export const isLegacyProductBinary = (executable: string): boolean => executable.toLowerCase().startsWith(PRODUCT.legacyName);

// Compiled Bun executables use a virtual import.meta.dir; their real install root
// is one directory above the binary folder (dist/ or an MCPB server/ directory).
export function installationRoot(sourceRoot: string): string {
  return isProductBinary(basename(process.execPath)) ? resolve(dirname(process.execPath), "..") : resolve(sourceRoot);
}
