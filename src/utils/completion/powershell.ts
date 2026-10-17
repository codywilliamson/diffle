// powershell completion script. refs are listed when tab is pressed, not when this is generated, and
// any ref that is not plainly safe is inserted as a single-quoted literal.

import { completionModel, namedCommands, type CompletionCommand } from "./model";
import { PROGRAM, powershellRefCommand, psSingleQuote, scopeFlagNames, uniqueFlagNames } from "./shared";

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
  const scopes: [string, string][] = model.flatMap((command) => command.scopes).map((scope) => [scope.key, list(scopeFlagNames(scope))]);
  const refCommands = model.filter((command) => command.completesRefs).map((command) => command.name);
  const review = model.find((command) => command.name === "review")!;
  return `# powershell completion for ${PROGRAM}
# install: ${PROGRAM} completion --shell powershell | Out-String | Invoke-Expression
Register-ArgumentCompleter -Native -CommandName ${PROGRAM}, ${PROGRAM}.exe -ScriptBlock {
  param($wordToComplete, $commandAst, $cursorPosition)
  $commands = ${hashtable(named.map((command) => [command.name, psSingleQuote(command.summary)]))}
  $scopes = ${hashtable(scopes)}
  $subcommands = ${hashtable(named.filter((command) => command.subcommands.length).map((command) => [command.name, list(command.subcommands)]))}
  $tips = ${hashtable(tips)}
  $choices = ${hashtable(choices)}
  $freeValue = ${list(free)}
  $refCommands = ${list(refCommands)}
  $reviewWords = ${list(review.words)}

  # the words before the cursor, program excluded; the command is the first one, as in the parser
  $typed = @($commandAst.CommandElements | Select-Object -Skip 1 | ForEach-Object { $_.ToString() })
  if ($wordToComplete -ne '' -and $typed.Count -gt 0) { $typed = @($typed | Select-Object -SkipLast 1) }
  $cmd = 'review'
  $lead = 0
  if ($typed.Count -gt 0 -and $commands.ContainsKey($typed[0])) { $cmd = $typed[0]; $lead = 1 }
  $scope = $cmd
  if ($subcommands.ContainsKey($cmd) -and $typed.Count -gt 1 -and $subcommands[$cmd] -contains $typed[1]) { $scope = "$cmd $($typed[1])"; $lead = 2 }
  $prev = ''
  if ($typed.Count -gt 0) { $prev = $typed[-1] }

  $positionals = 0
  $skipNext = $false
  for ($i = $lead; $i -lt $typed.Count; $i++) {
    if ($skipNext) { $skipNext = $false; continue }
    if ($freeValue -contains $typed[$i] -or $choices.ContainsKey($typed[$i])) { $skipNext = $true; continue }
    if ($typed[$i] -notlike '-*') { $positionals++ }
  }

  $items = @()
  if ($choices.ContainsKey($prev)) {
    foreach ($value in $choices[$prev]) { $items += [pscustomobject]@{ Text = $value; Insert = $value; Tip = $value } }
  } elseif ($freeValue -contains $prev) {
    return
  } elseif ($wordToComplete -like '-*') {
    if ($scopes.ContainsKey($scope)) {
      foreach ($flag in $scopes[$scope]) { $items += [pscustomobject]@{ Text = $flag; Insert = $flag; Tip = $tips[$flag] } }
    }
  } else {
    if ($typed.Count -eq 0) {
      foreach ($name in $commands.Keys) { $items += [pscustomobject]@{ Text = $name; Insert = $name; Tip = $commands[$name] } }
    }
    if ($typed.Count -eq 1 -and $subcommands.ContainsKey($cmd)) {
      foreach ($sub in $subcommands[$cmd]) { $items += [pscustomobject]@{ Text = $sub; Insert = $sub; Tip = $sub } }
    }
    if ($refCommands -contains $cmd -and $positionals -eq 0) {
      if ($cmd -eq 'review') { foreach ($word in $reviewWords) { $items += [pscustomobject]@{ Text = $word; Insert = $word; Tip = $word } } }
      foreach ($ref in @(${powershellRefCommand()})) {
        if (-not $ref) { continue }
        $insert = $ref
        if ($ref -notmatch '^[A-Za-z0-9_./+-]+$') { $insert = "'" + $ref.Replace("'", "''") + "'" }
        $items += [pscustomobject]@{ Text = $ref; Insert = $insert; Tip = $ref }
      }
    }
  }
  $prefix = $wordToComplete.TrimStart("'", '"')
  $items | Where-Object { $_.Text.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase) } | Sort-Object Text | ForEach-Object {
    [System.Management.Automation.CompletionResult]::new($_.Insert, $_.Text, 'ParameterValue', $_.Tip)
  }
}
`;
}
