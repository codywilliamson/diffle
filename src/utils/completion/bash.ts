// bash completion script. refs are listed when tab is pressed, not when this is generated, and
// they are only ever added as literal strings (never through compgen -W, which expands them).

import { completionModel, namedCommands, type CompletionCommand } from "./model";
import { PROGRAM, posixRefCommand, scopeFlagNames, valueFlagNames } from "./shared";

function valueCases(model: CompletionCommand[]): string {
  const seen = new Set<string>();
  const cases: string[] = [];
  for (const flag of model.flatMap((command) => command.scopes.flatMap((scope) => scope.flags)).filter((candidate) => candidate.takesValue)) {
    const pattern = flag.names.join("|");
    if (seen.has(pattern)) continue;
    seen.add(pattern);
    const call = flag.list ? `_${PROGRAM}_offer_list` : `_${PROGRAM}_offer`;
    const offer = flag.values.length ? `for word in ${flag.values.join(" ")}; do ${call} "$word"; done; ` : "";
    cases.push(`    ${pattern}) ${offer}return ;;`);
  }
  return cases.join("\n");
}

// commands that take a subcommand: find it at word 2, and note the command now spans two words.
function subcommandCases(model: CompletionCommand[]): string {
  return model.filter((command) => command.subcommands.length).map((command) => [
    `    ${command.name})`,
    `      subs="${command.subcommands.join(" ")}"`,
    `      if (( COMP_CWORD > 2 )); then case "\${COMP_WORDS[2]}" in ${command.subcommands.join("|")}) sub="\${COMP_WORDS[2]}"; lead=2 ;; esac; fi ;;`,
  ].join("\n")).join("\n");
}

const scopeCases = (model: CompletionCommand[]) =>
  model.flatMap((command) => command.scopes).map((scope) => `    '${scope.key}') flags="${scopeFlagNames(scope).join(" ")}" ;;`).join("\n");

const refCases = (model: CompletionCommand[]) =>
  model.filter((command) => command.completesRefs).map((command) => `    ${command.name}) words="${command.words.join(" ")}"; wantsrefs=1 ;;`).join("\n");

export function renderBash(): string {
  const model = completionModel();
  const named = namedCommands(model).map((command) => command.name);
  return `# bash completion for ${PROGRAM}
# install: eval "$(${PROGRAM} completion --shell bash)"
_${PROGRAM}_offer() {
  [[ "$1" == "$cur"* ]] && COMPREPLY+=("$1")
}
# a comma-separated list value: keep what was typed through the last comma, complete the rest
_${PROGRAM}_offer_list() {
  local head="\${cur%"\${cur##*,}"}" tail="\${cur##*,}"
  [[ "$1" == "$tail"* ]] && COMPREPLY+=("$head$1")
}
_${PROGRAM}() {
  local cur prev cmd=review sub="" scope lead=0 flags="" subs="" words="" wantsrefs=0 npos=0 skip=0 word ref i
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"
  COMPREPLY=()
  if (( COMP_CWORD > 1 )); then
    case "\${COMP_WORDS[1]}" in
      ${named.join("|")}) cmd="\${COMP_WORDS[1]}"; lead=1 ;;
    esac
  fi
  case "$cmd" in
${subcommandCases(model)}
  esac
  scope="$cmd\${sub:+ $sub}"
  case "$scope" in
${scopeCases(model)}
  esac
  case "$cmd" in
${refCases(model)}
  esac
  case "$prev" in
${valueCases(model)}
  esac
  for (( i = lead + 1; i < COMP_CWORD; i++ )); do
    word="\${COMP_WORDS[i]}"
    if (( skip )); then skip=0; continue; fi
    case "$word" in
      ${valueFlagNames(model).join("|")}) skip=1 ;;
      -*) ;;
      *) npos=$(( npos + 1 )) ;;
    esac
  done
  if [[ "$cur" == -* ]]; then
    for word in $flags; do _${PROGRAM}_offer "$word"; done
    return
  fi
  if [[ "$cmd" == review && "$prev" == browse ]]; then
    while IFS= read -r word; do COMPREPLY+=("$word"); done < <(compgen -d -- "$cur")
    return
  fi
  if (( COMP_CWORD == 1 )); then
    for word in ${named.join(" ")}; do _${PROGRAM}_offer "$word"; done
  fi
  if (( COMP_CWORD == 2 )); then
    for word in $subs; do _${PROGRAM}_offer "$word"; done
  fi
  if (( wantsrefs && npos == 0 )); then
    for word in $words; do _${PROGRAM}_offer "$word"; done
    while IFS= read -r ref; do _${PROGRAM}_offer "$ref"; done < <(${posixRefCommand()})
  fi
}
complete -F _${PROGRAM} ${PROGRAM}
`;
}
