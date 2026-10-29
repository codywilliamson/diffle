// the single machine-readable product identity. runtime labels, binary/package names, and
// manifest metadata all read from here. there are no command aliases: the binary is `name` only.
// the legacy identity exists so the first run of the renamed product can find and migrate an
// older install (data dir, env vars, plugins); it is never a second command.

const name = "nittle";
const legacyName = "diffle";
const loupeName = "loupe"; // the name before diffle; only ever migrated away from

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
  repository: "https://github.com/codywilliamson/nittle",
  // marketplaces registered before the repo rename still point here; they count as ours until moved
  legacyRepository: "https://github.com/codywilliamson/diffle",
  // claude code plugin identity — must match .claude-plugin/marketplace.json
  plugin: { name: `${name}-review`, marketplace: `${name}-local` },
  legacyPlugin: { name: `${legacyName}-review`, marketplace: `${legacyName}-local` },
  // every plugin / command identity the migration removes from agents (diffle's and loupe's)
  retiredPlugins: [
    { name: `${legacyName}-review`, marketplace: `${legacyName}-local` },
    { name: `${loupeName}-review`, marketplace: `${loupeName}-local` },
  ],
  retiredNames: [legacyName, loupeName],
} as const;

// owner/repo slug for `claude plugin marketplace add`
export function repositorySlug(): string {
  return PRODUCT.repository.replace(/^https?:\/\/github\.com\//, "");
}

export function legacyRepositorySlug(): string {
  return PRODUCT.legacyRepository.replace(/^https?:\/\/github\.com\//, "");
}
