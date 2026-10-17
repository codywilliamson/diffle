// renders the completion script for one shell.

import type { CompletionShell } from "../cliVocabulary";
import { renderBash } from "./bash";
import { renderFish } from "./fish";
import { renderPowerShell } from "./powershell";
import { renderZsh } from "./zsh";

const RENDERERS: Record<CompletionShell, () => string> = {
  bash: renderBash,
  zsh: renderZsh,
  fish: renderFish,
  powershell: renderPowerShell,
};

export const renderCompletion = (shell: CompletionShell): string => RENDERERS[shell]();
