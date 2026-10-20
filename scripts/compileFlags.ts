// flags every compiled nittle binary is built with. a compiled bun executable auto-loads .env
// from its cwd, and the cwd is the repository under review, so an untrusted .env could inject
// env (NITTLE_*, VIRTUAL_ENV, PATH) into nittle. never compile without these.
export const COMPILE_FLAGS = ["--compile", "--no-compile-autoload-dotenv"] as const;
