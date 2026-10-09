import type { LanguageAdapter } from "./adapter";
import {
  isTypescriptTest,
  matchesTypescript,
  typescriptGroupOf,
  typescriptNoise,
  typescriptSubject,
} from "./typescriptPaths";
import { typescriptFlags } from "./typescriptFlags";

export const typescriptAdapter: LanguageAdapter = {
  id: "typescript",
  matches: matchesTypescript,
  noise: typescriptNoise,
  isTest: isTypescriptTest,
  subjectName: typescriptSubject,
  groupOf: typescriptGroupOf,
  flags: typescriptFlags,
};
