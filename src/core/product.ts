// the single machine-readable product identity. runtime labels, binary/package names, and
// manifest metadata all read from here. there are no command aliases: the binary is `name` only.
// the legacy identity exists so the first run of the renamed product can find and migrate an
// older install (data dir, env vars, plugins); it is never a second command.

const name = "nittle";
const legacyName = "diffle";

export const PRODUCT = {
  name,
  legacyName,
  displayName: "Nittle Review",
  description: "Local git diff viewer with inline comments and structured agent feedback",
  envPrefix: "NITTLE_",
  legacyEnvPrefix: "DIFFLE_",
  dataDir: ".nittle",
  legacyDataDir: ".diffle",
  loupeDataDir: ".loupe", // pre-diffle data dir; 0.28.x kept using it in place, so it is still a migration source
  accent: "38;5;105", // nittle indigo (ansi 256)
  author: { name: "Cody Williamson", url: "https://github.com/codywilliamson" },
  site: "https://nittle.dev", // docs site + the `curl https://nittle.dev/install | sh` host
  // flips to the nittle slug after the github repo rename (old urls redirect; the new slug 404s until then)
  repository: "https://github.com/codywilliamson/diffle",
  // second line of `--version`; the first line stays `<name> v<version>` for parsers
  lineage:
    "fka diffle (the Deterministic Inspection & Feedback Framework for Language-model Engineering, per ADR 0004, which we stand by), fka loupe",
  // claude code plugin identity — must match .claude-plugin/marketplace.json
  plugin: { name: `${name}-review`, marketplace: `${name}-local` },
  legacyPlugin: { name: `${legacyName}-review`, marketplace: `${legacyName}-local` },
} as const;

// owner/repo slug for `claude plugin marketplace add`
export function repositorySlug(): string {
  return PRODUCT.repository.replace(/^https?:\/\/github\.com\//, "");
}
