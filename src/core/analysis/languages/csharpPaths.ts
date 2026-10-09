// c# path conventions: which files belong to the adapter, generated output, and test naming.

import type { FileNoise } from "../../../types";
import { baseName, dirSegments, stemOf } from "./flagHelpers";

const CODE_EXTENSIONS = /\.(cs|csx|razor|cshtml|csproj|props|targets|sln|slnx)$/i;
const DOTNET_CONFIG = /^(global\.json|nuget\.config|appsettings.*\.json)$/i;
const GENERATED_SUFFIXES = [".g.cs", ".g.i.cs", ".designer.cs", ".generated.cs", "modelsnapshot.cs"];
const TEST_PROJECT = /\.(tests|unittests|integrationtests|specs)$/i;
const TEST_FILE = /(Tests?|Specs?)\.cs$/;
const TEST_SUFFIX = /(Tests?|Specs?)$/;

export const matchesCsharp = (path: string): boolean => {
  const name = baseName(path);
  return CODE_EXTENSIONS.test(name) || DOTNET_CONFIG.test(name);
};

export function csharpNoise(path: string): FileNoise | null {
  const name = baseName(path).toLowerCase();
  if (GENERATED_SUFFIXES.some((s) => name.endsWith(s))) return "generated";
  if (name.endsWith(".cs") && dirSegments(path).some((s) => s.toLowerCase() === "obj")) return "generated";
  return null;
}

export function isCsharpTest(path: string): boolean {
  const name = baseName(path);
  if (TEST_FILE.test(name)) return true;
  const segs = name.toLowerCase().endsWith(".csproj") ? [...dirSegments(path), stemOf(name)] : dirSegments(path);
  return segs.some((s) => TEST_PROJECT.test(s));
}

export function csharpSubject(path: string): string {
  const stem = stemOf(baseName(path));
  const stripped = stem.replace(TEST_SUFFIX, "");
  return (stripped || stem).toLowerCase();
}
