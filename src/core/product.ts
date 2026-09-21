// the single machine-readable product identity. runtime labels, binary/package names, and
// manifest metadata all read from here. a deprecated legacy name, env prefix, and data dir are
// kept for one minor release so existing commands, scripts, env vars, and records keep working.

export const PRODUCT = {
  name: "diffle",
  legacyName: "loupe",
  displayName: "Diffle Review",
  description: "Local git diff viewer with inline comments and structured agent feedback",
  envPrefix: "DIFFLE_",
  legacyEnvPrefix: "LOUPE_",
  dataDir: ".diffle",
  legacyDataDir: ".loupe",
  accent: "38;5;105", // diffle indigo (ansi 256)
  author: { name: "Cody Williamson", url: "https://github.com/codywilliamson" },
  site: "https://diffle.dev", // docs site + the `curl https://diffle.dev/install | sh` host
  repository: "https://github.com/codywilliamson/diffle",
} as const;
