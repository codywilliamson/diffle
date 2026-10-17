// zsh completion script, usable two ways: sourced (registers itself with compdef) or saved as _nittle
// in $fpath (compinit autoloads it and the file body runs as the completion). refs are listed when tab
// is pressed, not when this is generated.

import { completionModel, namedCommands, type CompletionCommand } from "./model";
import { PROGRAM, posixRefCommand, shSingleQuote, valueFlagNames } from "./shared";

// _describe wants "name:description" with colons in the name escaped.
const entry = (name: string, description: string) => shSingleQuote(`${name.replace(/:/g, "\\:")}:${description}`);

function valueCases(model: CompletionCommand[]): string {
  const seen = new Set<string>();
  const cases: string[] = [];
  for (const flag of model.flatMap((command) => command.scopes.flatMap((scope) => scope.flags)).filter((candidate) => candidate.takesValue)) {
    const pattern = flag.names.join("|");
    if (seen.has(pattern)) continue;
    seen.add(pattern);
    cases.push(`    ${pattern}) ${flag.values.length ? `compadd -- ${flag.values.join(" ")}; ` : ""}return 0 ;;`);
  }
  return cases.join("\n");
}

// commands that take a subcommand: find it at word 3 and note the command now spans two words.
function subcommandCases(model: CompletionCommand[]): string {
  return model.filter((command) => command.subcommands.length).map((command) => [
    `    ${command.name})`,
    `      subs_=(${command.subcommands.join(" ")})`,
    `      if (( CURRENT > 3 )); then case "\${words[3]}" in ${command.subcommands.join("|")}) sub="\${words[3]}"; lead=2 ;; esac; fi ;;`,
  ].join("\n")).join("\n");
}

const scopeCases = (model: CompletionCommand[]) => model.flatMap((command) => command.scopes).map((scope) =>
  `    '${scope.key}') flags_=(${scope.flags.flatMap((flag) => flag.names.map((name) => entry(name, flag.description))).join(" ")}) ;;`).join("\n");

const refCases = (model: CompletionCommand[]) => model.filter((command) => command.completesRefs).map((command) =>
  `    ${command.name}) words_=(${command.words.map((word) => shSingleQuote(word)).join(" ")}); wantsrefs=1 ;;`).join("\n");

export function renderZsh(): string {
  const model = completionModel();
  const named = namedCommands(model);
  const commands = named.map((command) => entry(command.name, command.summary));
  return `#compdef ${PROGRAM}
# zsh completion for ${PROGRAM}
# install: source <(${PROGRAM} completion --shell zsh)    (after compinit)
# or save the output as _${PROGRAM} in a directory on your $fpath
_${PROGRAM}() {
  local cmd=review sub="" scope lead=0 npos=0 skip=0 wantsrefs=0 word i
  local -a flags_ subs_ words_ refs cmds_
  cmds_=(${commands.join(" ")})
  if (( CURRENT > 2 )); then
    case "\${words[2]}" in
      ${named.map((command) => command.name).join("|")}) cmd="\${words[2]}"; lead=1 ;;
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
  case "\${words[CURRENT-1]}" in
${valueCases(model)}
  esac
  for (( i = lead + 2; i < CURRENT; i++ )); do
    word="\${words[i]}"
    if (( skip )); then skip=0; continue; fi
    case "$word" in
      ${valueFlagNames(model).join("|")}) skip=1 ;;
      -*) ;;
      *) npos=$(( npos + 1 )) ;;
    esac
  done
  if [[ "$PREFIX" == -* ]]; then
    _describe -t options 'option' flags_
    return 0
  fi
  if [[ "$cmd" == review && "\${words[CURRENT-1]}" == browse ]]; then
    _path_files -/
    return 0
  fi
  (( CURRENT == 2 )) && _describe -t commands 'command' cmds_
  (( CURRENT == 3 )) && compadd -a subs_
  if (( wantsrefs && npos == 0 )); then
    refs=(\${(f)"$(${posixRefCommand()})"})
    compadd -a words_
    compadd -a refs
  fi
  return 0
}
if [[ "$funcstack[1]" == "_${PROGRAM}" ]]; then
  _${PROGRAM} "$@"
elif (( $+functions[compdef] )); then
  compdef _${PROGRAM} ${PROGRAM}
fi
`;
}
