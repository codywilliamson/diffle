import { bundledLanguages, bundledLanguagesAlias } from "shiki/langs";

// extensions shiki has no id or alias for.
const EXTENSIONS: Record<string, string> = {
  svg: "xml", csproj: "xml", fsproj: "xml", props: "xml", targets: "xml",
  h: "c", hpp: "cpp", hh: "cpp", psm1: "powershell", psd1: "powershell",
  pl: "perl", pm: "perl", m: "objective-c", ex: "elixir", exs: "elixir",
  gradle: "groovy", cshtml: "razor",
};

// files recognized by name rather than extension, lowercased.
const FILENAMES: Record<string, string> = {
  dockerfile: "docker", containerfile: "docker", makefile: "make", gnumakefile: "make",
  "cmakelists.txt": "cmake", codeowners: "codeowners", ".env": "dotenv",
};

function isBundled(lang: string): boolean {
  return lang in bundledLanguages || lang in bundledLanguagesAlias;
}

// shiki language id for a repo path, or null when there is no grammar for it.
export function languageFor(path: string): string | null {
  const name = path.split("/").pop()?.toLowerCase() ?? "";
  if (FILENAMES[name]) return FILENAMES[name];
  if (name.startsWith(".env.")) return "dotenv";
  if (name.startsWith("dockerfile.")) return "docker";
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return null;
  const ext = name.slice(dot + 1);
  const lang = EXTENSIONS[ext] ?? ext;
  return isBundled(lang) ? lang : null;
}
