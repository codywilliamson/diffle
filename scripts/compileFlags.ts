// flags every compiled nittle binary is built with. a compiled bun executable auto-loads .env
// from its cwd, and the cwd is the repository under review, so an untrusted .env could inject
// env (NITTLE_*, VIRTUAL_ENV, PATH) into nittle, and its bunfig.toml could preload code. never compile without these.
export const COMPILE_FLAGS = [
  "--compile",
  "--no-compile-autoload-dotenv",
  "--no-compile-autoload-bunfig", // a repo bunfig.toml with `preload` would run that repo's code inside nittle
  "--no-compile-autoload-tsconfig",
  "--no-compile-autoload-package-json",
] as const;
