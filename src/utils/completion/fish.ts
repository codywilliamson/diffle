// fish completion script. refs are listed when tab is pressed, not when this is generated.

import { completionModel, namedCommands, type CompletionCommand, type CompletionFlag } from "./model";
import { PROGRAM, fishSingleQuote, posixRefCommand } from "./shared";

const FN = `__${PROGRAM}`;

function flagLine(command: CompletionCommand, flag: CompletionFlag): string {
  const parts = [`complete -c ${PROGRAM} -n '${FN}_cmd_is ${command.name}'`];
  for (const name of flag.names) parts.push(name.startsWith("--") ? `-l ${name.slice(2)}` : `-s ${name.slice(1)}`);
  if (flag.takesValue) parts.push("-x");
  if (flag.values.length) parts.push(`-a ${fishSingleQuote(flag.values.join(" "))}`);
  parts.push(`-d ${fishSingleQuote(flag.description)}`);
  return parts.join(" ");
}

export function renderFish(): string {
  const model = completionModel();
  const named = namedCommands(model);
  const refNamed = named.filter((command) => command.completesRefs).map((command) => command.name);
  const review = model.find((command) => command.name === "review")!;
  const lines = [
    `# fish completion for ${PROGRAM}`,
    `# install: ${PROGRAM} completion --shell fish | source`,
    `# or save it as ~/.config/fish/completions/${PROGRAM}.fish`,
    `function ${FN}_args`,
    `    set -l words (commandline -opc)`,
    `    set -e words[1]`,
    `    for word in $words`,
    `        string match -q -- '-*' $word; or echo $word`,
    `    end`,
    `end`,
    `function ${FN}_cmd`,
    `    set -l args (${FN}_args)`,
    `    if set -q args[1]; and contains -- $args[1] ${named.map((command) => command.name).join(" ")}`,
    `        echo $args[1]`,
    `    else`,
    `        echo review`,
    `    end`,
    `end`,
    `function ${FN}_cmd_is`,
    `    test (${FN}_cmd) = $argv[1]`,
    `end`,
    `function ${FN}_at_start`,
    `    test (count (${FN}_args)) -eq 0`,
    `end`,
    `function ${FN}_needs_sub`,
    `    set -l args (${FN}_args)`,
    `    test (count $args) -eq 1; and test "$args[1]" = $argv[1]`,
    `end`,
    `function ${FN}_wants_ref`,
    `    set -l args (${FN}_args)`,
    `    test (count $args) -eq 0; and return 0`,
    `    test (count $args) -eq 1; and contains -- $args[1] ${refNamed.join(" ")}`,
    `end`,
    `function ${FN}_refs`,
    `    ${posixRefCommand()}`,
    `end`,
    ``,
    `complete -c ${PROGRAM} -f`,
    ...named.map((command) => `complete -c ${PROGRAM} -n '${FN}_at_start' -a ${command.name} -d ${fishSingleQuote(command.summary)}`),
    ...model.flatMap((command) => command.flags.map((flag) => flagLine(command, flag))),
    ...named.filter((command) => command.subcommands.length)
      .map((command) => `complete -c ${PROGRAM} -n '${FN}_needs_sub ${command.name}' -a ${fishSingleQuote(command.subcommands.join(" "))}`),
    `complete -c ${PROGRAM} -n '${FN}_at_start' -a ${fishSingleQuote(review.words.join(" "))}`,
    `complete -c ${PROGRAM} -n '${FN}_wants_ref' -a '(${FN}_refs)'`,
  ];
  return `${lines.join("\n")}\n`;
}
