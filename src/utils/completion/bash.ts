// bash completion script. refs are listed when tab is pressed, not when this is generated.

import { completionModel, namedCommands, type CompletionCommand } from "./model";
import { PROGRAM, firstPositionalIndex, flagNames, posixRefCommand } from "./shared";

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
    const refPos = command.completesRefs ? firstPositionalIndex(command) : 0;
    const subPos = command.subcommands.length ? firstPositionalIndex(command) : 0;
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
  local cur prev cmd=review flags subs words refpos subpos candidates
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"
  COMPREPLY=()
  if (( COMP_CWORD > 1 )); then
    case "\${COMP_WORDS[1]}" in
      ${named.join("|")}) cmd="\${COMP_WORDS[1]}" ;;
    esac
  fi
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
  if (( COMP_CWORD == 1 )); then candidates="${named.join(" ")}"; fi
  if (( subpos > 0 && COMP_CWORD == subpos )); then candidates="$candidates $subs"; fi
  if (( refpos > 0 && COMP_CWORD == refpos )); then
    candidates="$candidates $words $(${posixRefCommand()})"
  fi
  COMPREPLY=($(compgen -W "$candidates" -- "$cur"))
}
complete -F _${PROGRAM} ${PROGRAM}
`;
}
