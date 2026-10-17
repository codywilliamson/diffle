// bash completion script. refs are listed when tab is pressed, not when this is generated.

import { completionModel, namedCommands, type CompletionCommand } from "./model";
import { PROGRAM, flagNames, posixRefCommand, slotAfterPositionals, valueFlagNames } from "./shared";

function valueCases(model: CompletionCommand[]): string {
  const seen = new Set<string>();
  const cases: string[] = [];
  for (const command of model) {
    for (const flag of command.flags.filter((candidate) => candidate.takesValue)) {
      const pattern = flag.names.join("|");
      if (seen.has(pattern)) continue;
      seen.add(pattern);
      const reply = flag.values.length ? `COMPREPLY=($(compgen -W "${flag.values.join(" ")}" -- "$cur"))` : "COMPREPLY=()";
      cases.push(`    ${pattern}) ${reply}; return ;;`);
    }
  }
  return cases.join("\n");
}

function commandCases(model: CompletionCommand[]): string {
  return model.map((command) => {
    const refPos = command.completesRefs ? slotAfterPositionals(command) : -1;
    const subPos = command.subcommands.length ? slotAfterPositionals(command) : -1;
    return [
      `    ${command.name})`,
      `      flags="${flagNames(command).join(" ")}"`,
      `      subs="${command.subcommands.join(" ")}"`,
      `      words="${command.words.join(" ")}"`,
      `      refpos=${refPos}; subpos=${subPos} ;;`,
    ].join("\n");
  }).join("\n");
}

export function renderBash(): string {
  const model = completionModel();
  const named = namedCommands(model).map((command) => command.name);
  return `# bash completion for ${PROGRAM}
# install: eval "$(${PROGRAM} completion --shell bash)"
_${PROGRAM}() {
  local cur prev cmd=review flags subs words refpos subpos candidates npos=0 skip=0 first="" word i
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"
  COMPREPLY=()
  for (( i = 1; i < COMP_CWORD; i++ )); do
    word="\${COMP_WORDS[i]}"
    if (( skip )); then skip=0; continue; fi
    case "$word" in
      ${valueFlagNames(model).join("|")}) skip=1 ;;
      -*) ;;
      *) (( npos == 0 )) && first="$word"; npos=$(( npos + 1 )) ;;
    esac
  done
  case "$first" in
    ${named.join("|")}) cmd="$first" ;;
  esac
  case "$prev" in
${valueCases(model)}
  esac
  case "$cmd" in
${commandCases(model)}
  esac
  if [[ "$cur" == -* ]]; then
    COMPREPLY=($(compgen -W "$flags" -- "$cur"))
    return
  fi
  if [[ "$cmd" == review && "$prev" == browse ]]; then
    COMPREPLY=($(compgen -d -- "$cur"))
    return
  fi
  candidates=""
  if (( npos == 0 )); then candidates="${named.join(" ")}"; fi
  if (( subpos >= 0 && npos == subpos )); then candidates="$candidates $subs"; fi
  if (( refpos >= 0 && npos == refpos )); then
    candidates="$candidates $words $(${posixRefCommand()})"
  fi
  COMPREPLY=($(compgen -W "$candidates" -- "$cur"))
}
complete -F _${PROGRAM} ${PROGRAM}
`;
}
