// powershell completion script. refs are listed when tab is pressed, not when this is generated.

import { completionModel, namedCommands, type CompletionCommand } from "./model";
import { PROGRAM, flagNames, powershellRefCommand, psSingleQuote, uniqueFlagNames } from "./shared";

const list = (items: readonly string[]) => (items.length ? `@(${items.map(psSingleQuote).join(", ")})` : "@()");

function hashtable(entries: [string, string][]): string {
  return `@{\n${entries.map(([key, value]) => `    ${psSingleQuote(key)} = ${value}`).join("\n")}\n  }`;
}

function valueFlagTables(model: CompletionCommand[]) {
  const choices: [string, string][] = [];
  const free: string[] = [];
  for (const [name, flag] of uniqueFlagNames(model)) {
    if (!flag.takesValue) continue;
    if (flag.values.length) choices.push([name, list(flag.values)]);
    else free.push(name);
  }
  return { choices, free };
}

export function renderPowerShell(): string {
  const model = completionModel();
  const named = namedCommands(model);
  const { choices, free } = valueFlagTables(model);
  const tips: [string, string][] = [...uniqueFlagNames(model)].map(([name, flag]) => [name, psSingleQuote(flag.description)]);
  const refNamed = named.filter((command) => command.completesRefs).map((command) => command.name);
  const review = model.find((command) => command.name === "review")!;
  return `# powershell completion for ${PROGRAM}
# install: ${PROGRAM} completion --shell powershell | Out-String | Invoke-Expression
Register-ArgumentCompleter -Native -CommandName ${PROGRAM}, ${PROGRAM}.exe -ScriptBlock {
  param($wordToComplete, $commandAst, $cursorPosition)
  $commands = ${hashtable(named.map((command) => [command.name, psSingleQuote(command.summary)]))}
  $flags = ${hashtable(model.map((command) => [command.name, list(flagNames(command))]))}
  $subcommands = ${hashtable(named.filter((command) => command.subcommands.length).map((command) => [command.name, list(command.subcommands)]))}
  $tips = ${hashtable(tips)}
  $choices = ${hashtable(choices)}
  $freeValue = ${list(free)}
  $refCommands = ${list(refNamed)}
  $reviewWords = ${list(review.words)}

  $typed = @($commandAst.CommandElements | Select-Object -Skip 1 | ForEach-Object { $_.ToString() })
  if ($wordToComplete -ne '' -and $typed.Count -gt 0) { $typed = @($typed | Select-Object -SkipLast 1) }
  $cmd = 'review'
  if ($typed.Count -gt 0 -and $commands.ContainsKey($typed[0])) { $cmd = $typed[0] }
  $prev = ''
  if ($typed.Count -gt 0) { $prev = $typed[-1] }

  $positionals = @()
  $skipNext = $false
  foreach ($word in $typed) {
    if ($skipNext) { $skipNext = $false; continue }
    if ($freeValue -contains $word -or $choices.ContainsKey($word)) { $skipNext = $true; continue }
    if ($word -notlike '-*') { $positionals += $word }
  }

  $items = @()
  if ($choices.ContainsKey($prev)) {
    foreach ($value in $choices[$prev]) { $items += [pscustomobject]@{ Text = $value; Tip = $value } }
  } elseif ($freeValue -contains $prev) {
    return
  } elseif ($wordToComplete -like '-*') {
    foreach ($flag in $flags[$cmd]) { $items += [pscustomobject]@{ Text = $flag; Tip = $tips[$flag] } }
  } else {
    if ($positionals.Count -eq 0) {
      foreach ($name in $commands.Keys) { $items += [pscustomobject]@{ Text = $name; Tip = $commands[$name] } }
    }
    if ($subcommands.ContainsKey($cmd) -and $positionals.Count -eq 1) {
      foreach ($sub in $subcommands[$cmd]) { $items += [pscustomobject]@{ Text = $sub; Tip = $sub } }
    }
    $wantsRef = ($cmd -eq 'review' -and $positionals.Count -eq 0) -or ($refCommands -contains $cmd -and $positionals.Count -eq 1)
    if ($wantsRef) {
      if ($cmd -eq 'review') { foreach ($word in $reviewWords) { $items += [pscustomobject]@{ Text = $word; Tip = $word } } }
      foreach ($ref in @(${powershellRefCommand()})) { if ($ref) { $items += [pscustomobject]@{ Text = $ref; Tip = $ref } } }
    }
  }
  $items | Where-Object { $_.Text -like "$wordToComplete*" } | Sort-Object Text | ForEach-Object {
    [System.Management.Automation.CompletionResult]::new($_.Text, $_.Text, 'ParameterValue', $_.Tip)
  }
}
`;
}
