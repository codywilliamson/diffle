// fallback adapter for every language we have no specific rules for.

import type { LanguageAdapter } from "./adapter";
import { baseName, commonFlags, dirSegments, stemOf, topLevelGroup } from "./flagHelpers";

const TEST_FOLDERS = new Set(["test", "tests", "spec", "specs", "__tests__"]);
const TEST_NAME = /(^test_)|([._]test\.)|([._]spec\.)/i;
const TEST_AFFIX = /^test_|[._](test|spec)$/i;

export const genericAdapter: LanguageAdapter = {
  id: "generic",
  matches: () => true,
  noise: () => null,
  isTest: (path) => dirSegments(path).some((s) => TEST_FOLDERS.has(s.toLowerCase())) || TEST_NAME.test(baseName(path)),
  subjectName: (path) => stemOf(baseName(path)).replace(TEST_AFFIX, "").toLowerCase(),
  groupOf: (path) => topLevelGroup(path),
  flags: (file) => commonFlags(file),
};
