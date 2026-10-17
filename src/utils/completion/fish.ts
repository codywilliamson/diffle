// fish completion script. refs are listed when tab is pressed, not when this is generated.

import { completionModel, namedCommands, type CompletionCommand, type CompletionFlag } from "./model";
import { PROGRAM, fishSingleQuote, posixRefCommand, valueFlagNames } from "./shared";

const FN = `__${PROGRAM}`;

function flagLine(scopeKey: string, flag: CompletionFlag): string {
  const parts = [`complete -c ${PROGRAM} -n '${FN}_scope_is "${scopeKey}"'`];
  for (const name of flag.names) parts.push(name.startsWith("--") ? `-l ${name.slice(2)}` : `-s ${name.slice(1)}`);
  if (flag.takesValue) parts.push("-x");
  if (flag.values.length) parts.push(`-a ${fishSingleQuote(flag.values.join(" "))}`);
  parts.push(`-d ${fishSingleQuote(flag.description)}`);
  return parts.join(" ");
}

// the scope of the line so far: the command, plus its subcommand when one has been typed.
function scopeFunction(model: CompletionCommand[]): string[] {
  const withSubs = model.filter((command) => command.subcommands.length);
  return [
    `function ${FN}_scope`,
    `    set -l words (commandline -opc)`,
    `    set -e words[1]`,
    `    set -l cmd (${FN}_cmd)`,
    ...withSubs.flatMap((command) => [
      `    if test "$cmd" = ${command.name}; and set -q words[2]; and contains -- $words[2] ${command.subcommands.join(" ")}`,
      `        echo "$cmd $words[2]"; return`,
      `    end`,
    ]),
    `    echo $cmd`,
    `end`,
  ];
}

export function renderFish(): string {
  const model = completionModel();
  const named = namedCommands(model);
  const names = named.map((command) => command.name).join(" ");
  const refNamed = model.filter((command) => command.completesRefs).map((command) => command.name).join(" ");
  const review = model.find((command) => command.name === "review")!;
  const lines = [
    `# fish completion for ${PROGRAM}`,
    `# install: ${PROGRAM} completion --shell fish | source`,
    `# or save it as ~/.config/fish/completions/${PROGRAM}.fish`,
    // the command is the first word, as in the parser; anything else is the default review command
    `function ${FN}_cmd`,
    `    set -l words (commandline -opc)`,
    `    set -e words[1]`,
    `    if set -q words[1]; and contains -- $words[1] ${names}`,
    `        echo $words[1]`,
    `    else`,
    `        echo review`,
    `    end`,
    `end`,
    ...scopeFunction(model),
    `function ${FN}_scope_is`,
    `    test (${FN}_scope) = "$argv[1]"`,
    `end`,
    // positional words after the command words, skipping the value that follows a value flag
    `function ${FN}_args`,
    `    set -l words (commandline -opc)`,
    `    set -e words[1]`,
    `    set -l scope (${FN}_scope)`,
    `    set -l lead 0`,
    `    test "$scope" != review; and set lead (count (string split ' ' -- $scope))`,
    `    set -l seen 0`,
    `    set -l skip 0`,
    `    for word in $words`,
    `        set seen (math $seen + 1)`,
    `        test $seen -le $lead; and continue`,
    `        if test $skip -eq 1`,
    `            set skip 0`,
    `        else if contains -- $word ${valueFlagNames(model).join(" ")}`,
    `            set skip 1`,
    `        else if not string match -q -- '-*' $word`,
    `            echo $word`,
    `        end`,
    `    end`,
    `end`,
    `function ${FN}_at_start`,
    `    test (count (commandline -opc)) -eq 1`,
    `end`,
    `function ${FN}_needs_sub`,
    `    test (count (commandline -opc)) -eq 2; and test (${FN}_cmd) = $argv[1]`,
    `end`,
    `function ${FN}_wants_ref`,
    `    contains -- (${FN}_cmd) ${refNamed}; and test (count (${FN}_args)) -eq 0`,
    `end`,
    `function ${FN}_wants_review_word`,
    `    test (${FN}_cmd) = review; and test (count (${FN}_args)) -eq 0`,
    `end`,
    `function ${FN}_refs`,
    `    ${posixRefCommand()}`,
    `end`,
    ``,
    `complete -c ${PROGRAM} -f`,
    ...named.map((command) => `complete -c ${PROGRAM} -n '${FN}_at_start' -a ${command.name} -d ${fishSingleQuote(command.summary)}`),
    ...model.flatMap((command) => command.scopes.flatMap((scope) => scope.flags.map((flag) => flagLine(scope.key, flag)))),
    ...named.filter((command) => command.subcommands.length)
      .map((command) => `complete -c ${PROGRAM} -n '${FN}_needs_sub ${command.name}' -a ${fishSingleQuote(command.subcommands.join(" "))}`),
    `complete -c ${PROGRAM} -n '${FN}_wants_review_word' -a ${fishSingleQuote(review.words.join(" "))}`,
    `complete -c ${PROGRAM} -n '${FN}_wants_ref' -a '(${FN}_refs)'`,
  ];
  return `${lines.join("\n")}\n`;
}
