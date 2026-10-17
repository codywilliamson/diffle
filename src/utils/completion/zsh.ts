// zsh completion script. refs are listed when tab is pressed, not when this is generated.

import { completionModel, namedCommands, type CompletionCommand } from "./model";
import { PROGRAM, firstPositionalIndex, posixRefCommand, shSingleQuote } from "./shared";

// _describe wants "name:description" with colons in the name escaped.
const entry = (name: string, description: string) => shSingleQuote(`${name.replace(/:/g, "\\:")}:${description}`);

function valueCases(model: CompletionCommand[]): string {
  const seen = new Set<string>();
  const cases: string[] = [];
  for (const command of model) {
    for (const flag of command.flags.filter((candidate) => candidate.takesValue)) {
      const pattern = flag.names.join("|");
      if (seen.has(pattern)) continue;
      seen.add(pattern);
      cases.push(`    ${pattern}) ${flag.values.length ? `compadd -- ${flag.values.join(" ")}; ` : ""}return ;;`);
    }
  }
  return cases.join("\n");
}

function commandCases(model: CompletionCommand[]): string {
  return model.map((command) => {
    const flags = command.flags.flatMap((flag) => flag.names.map((name) => entry(name, flag.description)));
    const subs = command.subcommands.map((sub) => shSingleQuote(sub));
    const words = command.words.map((word) => shSingleQuote(word));
    // zsh words are 1-based and the program is word 1, so the first positional is one past the 0-based index
    const refPos = command.completesRefs ? firstPositionalIndex(command) + 1 : 0;
    const subPos = command.subcommands.length ? firstPositionalIndex(command) + 1 : 0;
    return [
      `    ${command.name})`,
      `      flags_=(${flags.join(" ")})`,
      `      subs_=(${subs.join(" ")})`,
      `      words_=(${words.join(" ")})`,
      `      refpos=${refPos}; subpos=${subPos} ;;`,
    ].join("\n");
  }).join("\n");
}

export function renderZsh(): string {
  const model = completionModel();
  const named = namedCommands(model);
  const commands = named.map((command) => entry(command.name, command.summary));
  return `#compdef ${PROGRAM}
# zsh completion for ${PROGRAM}
# install: source <(${PROGRAM} completion --shell zsh)    (after compinit)
_${PROGRAM}() {
  local cmd=review refpos=0 subpos=0
  local -a flags_ subs_ words_ refs cmds_
  cmds_=(${commands.join(" ")})
  if (( CURRENT > 2 )); then
    case "\${words[2]}" in
      ${named.map((command) => command.name).join("|")}) cmd="\${words[2]}" ;;
    esac
  fi
  case "\${words[CURRENT-1]}" in
${valueCases(model)}
  esac
  case "$cmd" in
${commandCases(model)}
  esac
  if [[ "$PREFIX" == -* ]]; then
    _describe -t options 'option' flags_
    return
  fi
  if [[ "$cmd" == review && "\${words[CURRENT-1]}" == browse ]]; then
    _path_files -/
    return
  fi
  (( CURRENT == 2 )) && _describe -t commands 'command' cmds_
  (( subpos > 0 && CURRENT == subpos )) && compadd -a subs_
  if (( refpos > 0 && CURRENT == refpos )); then
    refs=(\${(f)"$(${posixRefCommand()})"})
    compadd -a words_
    compadd -a refs
  fi
  return 0
}
if (( $+functions[compdef] )); then compdef _${PROGRAM} ${PROGRAM}; fi
`;
}
