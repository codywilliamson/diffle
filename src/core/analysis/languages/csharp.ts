import type { LanguageAdapter } from "./adapter";
import { csharpFlags } from "./csharpFlags";
import { csharpNoise, csharpSubject, isCsharpTest, matchesCsharp } from "./csharpPaths";
import { csharpGroupDependencies, csharpGroupOf } from "./csharpProjects";

export const csharpAdapter: LanguageAdapter = {
  id: "csharp",
  matches: matchesCsharp,
  noise: csharpNoise,
  isTest: isCsharpTest,
  subjectName: csharpSubject,
  groupOf: csharpGroupOf,
  groupDependencies: csharpGroupDependencies,
  flags: csharpFlags,
};
