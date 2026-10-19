# nittle installer (Windows) — downloads the matching release binary, verifies its sha-256,
# installs it to ~\.nittle\bin, and puts that directory on the user PATH.
# An existing diffle install is migrated: after installing, `nittle --version` runs once and the
# binary's own startup migration moves data and plugins and removes every diffle leftover.
# Usage: irm https://<host>/install.ps1 | iex
# Env knobs: NITTLE_INSTALL_DIR, NITTLE_DRY_RUN, NITTLE_NO_MODIFY_PATH, NITTLE_NO_SETUP, NITTLE_UNINSTALL,
#   NITTLE_PATH_SCOPE_FILE (test seam), GITHUB_TOKEN (optional; authenticates the release lookup)
#   each NITTLE_* falls back to its deprecated DIFFLE_* twin
#Requires -Version 7.0
& {
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false

# #Requires is not enforced under `irm | iex`, so check at runtime too
if ($PSVersionTable.PSVersion.Major -lt 7) {
  throw "nittle install: PowerShell 7.0 or newer is required (found $($PSVersionTable.PSVersion))"
}

$Repo = 'codywilliamson/diffle' # the github repo keeps its old slug until it is renamed
$Name = 'nittle'
$LegacyName = 'diffle'

# NITTLE_<name>, else the deprecated DIFFLE_<name>
function Get-InstallerOption {
  param([Parameter(Mandatory)][string] $Option)
  $value = [Environment]::GetEnvironmentVariable("NITTLE_$Option")
  if ($value) { return $value }
  return [Environment]::GetEnvironmentVariable("DIFFLE_$Option")
}

$BinDir = if (Get-InstallerOption 'INSTALL_DIR') { Get-InstallerOption 'INSTALL_DIR' } else { Join-Path $HOME '.nittle\bin' }
$LegacyBinDir = if ($env:DIFFLE_INSTALL_DIR) { $env:DIFFLE_INSTALL_DIR } else { Join-Path $HOME '.diffle\bin' }
$Target = Join-Path $BinDir "$Name.exe"
$LegacyTarget = Join-Path $LegacyBinDir "$LegacyName.exe"
$DryRun = [bool](Get-InstallerOption 'DRY_RUN')
$NoModifyPath = [bool](Get-InstallerOption 'NO_MODIFY_PATH')
$Uninstall = [bool](Get-InstallerOption 'UNINSTALL')
$NoSetup = [bool](Get-InstallerOption 'NO_SETUP')
$PathScopeFile = Get-InstallerOption 'PATH_SCOPE_FILE'
$SpinnerFrames = '|', '/', '-', '\'
$Rule = '=' * 72
# animate only on a real console; redirected/CI output gets a single WAIT line per wait
$Animate = [Environment]::UserInteractive -and -not [Console]::IsOutputRedirected -and
  $Host.Name -eq 'ConsoleHost' -and [bool](Get-Command Start-ThreadJob -ErrorAction SilentlyContinue)

function Write-Log {
  param([Parameter(Mandatory)][string] $Level, [Parameter(Mandatory)][string] $Message)
  $color = switch ($Level) {
    'WAIT' { 'Yellow' }
    'OK' { 'Green' }
    'WARN' { 'DarkYellow' }
    'ERROR' { 'Red' }
    default { 'Gray' }
  }
  Write-Host ('[{0}] [{1}] {2}' -f (Get-Date -Format 'HH:mm:ss'), $Level, $Message) -ForegroundColor $color
}

function Write-Section {
  param([Parameter(Mandatory)][string] $Title)
  Write-Host ''
  Write-Host $Rule -ForegroundColor DarkCyan
  Write-Host $Title -ForegroundColor Cyan
  Write-Host $Rule -ForegroundColor DarkCyan
}

# runs $Action on this thread (mocked cmdlets live here); only the spinner gets a worker thread
function Invoke-Step {
  param([Parameter(Mandatory)][string] $Message, [Parameter(Mandatory)][scriptblock] $Action)

  if (-not $Animate) {
    Write-Log WAIT $Message
    return & $Action
  }
  $spinner = Start-ThreadJob -ArgumentList $Message, $SpinnerFrames -ScriptBlock {
    param($text, $frames)
    $clock = [Diagnostics.Stopwatch]::StartNew()
    $tick = 0
    while ($true) {
      [Console]::Write(("`r[{0}] {1} ({2:N1}s)  " -f $frames[$tick++ % $frames.Count], $text, $clock.Elapsed.TotalSeconds))
      Start-Sleep -Milliseconds 120
    }
  }
  try { return & $Action }
  finally {
    $spinner | Stop-Job -ErrorAction SilentlyContinue
    $spinner | Remove-Job -Force -ErrorAction SilentlyContinue
    [Console]::Write("`r" + (' ' * ($Message.Length + 20)) + "`r")
  }
}

# NITTLE_PATH_SCOPE_FILE is a test seam: read/write the "user PATH" from a file, never the registry.
# The registry is read raw (DoNotExpandEnvironmentNames) so %VAR% tokens in entries we did not add
# survive verbatim — [Environment]::GetEnvironmentVariable would expand them into the stored value.
function Get-UserPath {
  if ($PathScopeFile) {
    if (Test-Path -LiteralPath $PathScopeFile) { return [IO.File]::ReadAllText($PathScopeFile) }
    return ''
  }
  $key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment', $false)
  try {
    if (-not $key) { return '' }
    return [string]$key.GetValue('PATH', '', [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
  }
  finally { if ($key) { $key.Dispose() } }
}

function Set-UserPath {
  param([Parameter(Mandatory)][AllowEmptyString()][string] $Value)
  if ($PathScopeFile) {
    [IO.File]::WriteAllText($PathScopeFile, $Value)
    return
  }
  $key = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey('Environment', $true)
  try {
    $kind = if ($key.GetValueNames() -contains 'PATH') { $key.GetValueKind('PATH') }
    else { [Microsoft.Win32.RegistryValueKind]::ExpandString }
    $key.SetValue('PATH', $Value, $kind)
  }
  finally { if ($key) { $key.Dispose() } }
  Publish-EnvironmentChange
}

function Publish-EnvironmentChange {
  try {
    if (-not ('Nittle.NativeMethods' -as [type])) {
      Add-Type -Namespace Nittle -Name NativeMethods -MemberDefinition @'
[System.Runtime.InteropServices.DllImport("user32.dll", SetLastError = true, CharSet = System.Runtime.InteropServices.CharSet.Auto)]
public static extern System.IntPtr SendMessageTimeout(System.IntPtr hWnd, uint Msg, System.UIntPtr wParam, string lParam, uint fuFlags, uint uTimeout, out System.UIntPtr lpdwResult);
'@
    }
    $answer = [UIntPtr]::Zero
    $broadcast = @{
      hWnd = [IntPtr]0xffff
      Msg = 0x1a          # WM_SETTINGCHANGE
      wParam = [UIntPtr]::Zero
      lParam = 'Environment'
      fuFlags = 2         # SMTO_ABORTIFHUNG
      uTimeout = 5000
    }
    [void][Nittle.NativeMethods]::SendMessageTimeout(
      $broadcast.hWnd, $broadcast.Msg, $broadcast.wParam, $broadcast.lParam,
      $broadcast.fuFlags, $broadcast.uTimeout, [ref]$answer)
  }
  catch {
    Write-Log WARN 'could not broadcast the environment change; open apps may need a restart'
  }
}

# whitespace and newlines (Set-Content leaves one), trailing slashes; comparison is case-insensitive
function ConvertTo-PathKey {
  param([Parameter(Mandatory)][AllowEmptyString()][string] $Entry)
  return $Entry.Trim().TrimEnd('\', '/').Trim()
}

function Test-SamePathEntry {
  param([Parameter(Mandatory)][AllowEmptyString()][string] $Entry, [Parameter(Mandatory)][string] $Directory)
  return (ConvertTo-PathKey $Entry) -ieq (ConvertTo-PathKey $Directory)
}

function Add-NittleToUserPath {
  [CmdletBinding(SupportsShouldProcess)]
  param([Parameter(Mandatory)][string] $Directory)

  $current = Get-UserPath
  if (@($current -split ';') | Where-Object { Test-SamePathEntry $_ $Directory }) {
    Write-Log INFO "$Directory is already on the user PATH; no change"
    return
  }
  # report the plan in our own log format rather than the default "What if:" line
  if ($WhatIfPreference) {
    Write-Log INFO "dry run: would prepend $Directory to the user PATH"
    return
  }
  if (-not $PSCmdlet.ShouldProcess('user PATH', "prepend $Directory")) { return }

  $backup = Join-Path ([IO.Path]::GetTempPath()) ('nittle-userpath-{0:yyyyMMdd-HHmmss}.txt' -f (Get-Date))
  [IO.File]::WriteAllText($backup, $current)
  Write-Log INFO "backed up the prior user PATH to $backup"

  # concatenate rather than split/rejoin: every existing entry stays byte for byte what it was
  Set-UserPath $(if ($current) { "$Directory;$current" } else { $Directory })
  $env:PATH = "$Directory;$env:PATH"
  Write-Log OK "added $Directory to the user PATH"
  Write-Log INFO 'other open shells need a restart to pick it up'
}

function Remove-NittleFromUserPath {
  [CmdletBinding(SupportsShouldProcess)]
  param([Parameter(Mandatory)][string] $Directory)

  $current = Get-UserPath
  $updated = @($current -split ';' | Where-Object { -not (Test-SamePathEntry $_ $Directory) }) -join ';'
  if ($updated -ceq $current) {
    Write-Log INFO "$Directory is not on the user PATH; no change"
    return
  }
  if ($WhatIfPreference) {
    Write-Log INFO "dry run: would remove $Directory from the user PATH"
    return
  }
  if (-not $PSCmdlet.ShouldProcess('user PATH', "remove $Directory")) { return }
  Set-UserPath $updated
  $env:PATH = @($env:PATH -split ';' | Where-Object { -not (Test-SamePathEntry $_ $Directory) }) -join ';'
  Write-Log OK "removed $Directory from the user PATH"
}

function Update-UserPath {
  param([Parameter(Mandatory)][ValidateSet('Add', 'Remove')][string] $Action)

  Write-Section 'PATH'
  if ($NoModifyPath) {
    Write-Log INFO 'NITTLE_NO_MODIFY_PATH is set; leaving the user PATH alone'
    if ($Action -eq 'Add') { Write-Log INFO "add $BinDir to your user PATH yourself to run $Name from any shell" }
    return
  }
  if ($Action -eq 'Add') { Add-NittleToUserPath -Directory $BinDir -WhatIf:$DryRun }
  else {
    Remove-NittleFromUserPath -Directory $BinDir -WhatIf:$DryRun
    if (-not (Test-SamePathEntry $LegacyBinDir $BinDir)) { Remove-NittleFromUserPath -Directory $LegacyBinDir -WhatIf:$DryRun }
  }
}

# windows locks a running exe (open reviews, mcp servers) against overwrite but not rename, so
# retire it aside like `nittle update` does; running copies keep working, the next update removes it
$StopHint = "stop every running $Name first (close open reviews and end agent sessions using the $Name MCP server)"
function Move-ExistingAside {
  param([Parameter(Mandatory)][string] $Path)
  if (-not (Test-Path -LiteralPath $Path)) { return }
  $Retired = Join-Path (Split-Path -Parent $Path) ".$(Split-Path -Leaf $Path).old"
  Remove-Item -LiteralPath $Retired -Force -ErrorAction SilentlyContinue
  # an older retired copy still held by a running process can't be removed; retire to a fresh name
  if (Test-Path -LiteralPath $Retired) { $Retired = "$Retired-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())" }
  try { Move-Item -LiteralPath $Path -Destination $Retired -ErrorAction Stop }
  catch { throw "nittle install: could not move the existing $Path aside ($($_.Exception.Message)) — $StopHint, then rerun the installer" }
}

function Save-ReleaseAsset($ReleaseAsset, $Destination) {
  try {
    Invoke-WebRequest -Uri $ReleaseAsset.browser_download_url -OutFile $Destination -UseBasicParsing -ErrorAction Stop
  }
  catch {
    throw "nittle install: failed to download $($ReleaseAsset.name) for $Tag"
  }
}

# skipped on dry runs, NITTLE_NO_SETUP, or without an interactive console; a failed setup never
# fails the install
function Test-Terminal {
  [Environment]::UserInteractive -and -not [Console]::IsInputRedirected -and -not [Console]::IsOutputRedirected
}

# agent configs point at the binary, so unregister them while it still exists. releases before
# `setup` existed would treat it as a git ref, so check the help text first
function Invoke-AgentTeardown {
  if ($NoSetup -or -not (Test-Path -LiteralPath $Target)) { return }
  if (-not ((& $Target --help 2>$null) -match ' setup')) { return }
  if (-not (Test-Terminal)) {
    Write-Log INFO "no terminal: if you ran '$Name setup', run '$Name setup --remove' before uninstalling"
    return
  }
  $global:LASTEXITCODE = 0
  try { & $Target setup --remove } catch { $global:LASTEXITCODE = 1 }
  # a cancelled or failed teardown keeps the binary so `setup --remove` can still be rerun
  if ($LASTEXITCODE -ne 0) {
    throw "agent teardown did not finish, so $Name is still installed; rerun, or set NITTLE_NO_SETUP=1 to skip it"
  }
}

function Invoke-AgentSetupOffer {
  if ($DryRun -or $NoSetup) { return }
  if (-not (Test-Terminal)) { return }
  Write-Section 'Agent setup'
  $answer = Read-Host "Set up $Name for your coding agents? [Y/n]"
  if ($answer -match '^\s*n') {
    Write-Log INFO "skipped; run '$Name setup' any time to wire up your coding agents"
    return
  }
  $global:LASTEXITCODE = 0
  try { & $Target setup } catch { $global:LASTEXITCODE = 1 }
  if ($LASTEXITCODE -eq 0) { Write-Log OK 'agent setup complete' }
  else { Write-Log WARN "agent setup did not finish; run '$Name setup' to retry" }
}

# removes the binary and its retired/staged leftovers, then the bin dir if that leaves it empty. a
# binary a running process still holds is renamed aside instead; the next nittle run removes it
function Remove-Installed {
  param([Parameter(Mandatory)][string] $Directory, [Parameter(Mandatory)][string] $Executable)
  $Path = Join-Path $Directory $Executable
  if (Test-Path -LiteralPath $Path) {
    try { Remove-Item -LiteralPath $Path -Force -ErrorAction Stop; Write-Log OK "removed $Path" }
    catch { Write-Log WARN "could not remove $Path because it is in use. close whatever is running it, then delete it yourself: $Path" }
  }
  $Stem = [IO.Path]::GetFileNameWithoutExtension($Executable)
  if (Test-Path -LiteralPath $Directory) {
    # only what the installer and updater leave behind: staged (.stem.new-*, .stem.exe.new) and retired (.stem.exe.old*)
    $Leftover = "^\.$([regex]::Escape($Stem))(\.exe)?\.(old(-\d+)?|new(-[\w-]+)?)$"
    Get-ChildItem -LiteralPath $Directory -Force -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -match $Leftover } |
      Remove-Item -Force -ErrorAction SilentlyContinue
    if (-not (Get-ChildItem -LiteralPath $Directory -Force -ErrorAction SilentlyContinue)) {
      Remove-Item -LiteralPath $Directory -Force -ErrorAction SilentlyContinue
    }
  }
}

# the data dir (the bin dir's parent, when it is the product's own) goes only if it is already empty
function Remove-EmptyDataDir {
  param([Parameter(Mandatory)][string] $BinDirectory, [Parameter(Mandatory)][string] $DataDirName)
  $Data = Split-Path -Parent $BinDirectory
  if ((Split-Path -Leaf $Data) -ine $DataDirName -or -not (Test-Path -LiteralPath $Data)) { return }
  if (Get-ChildItem -LiteralPath $Data -Force -ErrorAction SilentlyContinue) {
    Write-Log INFO "review records and settings remain in $Data — delete that folder to remove them"
    return
  }
  Remove-Item -LiteralPath $Data -Force -ErrorAction SilentlyContinue
  Write-Log OK "removed empty $Data"
}

# an existing diffle install: its binary, or its entry on the user PATH
function Test-LegacyInstall {
  if (Test-Path -LiteralPath $LegacyTarget) { return $true }
  return [bool](@((Get-UserPath) -split ';') | Where-Object { Test-SamePathEntry $_ $LegacyBinDir })
}

# a seam so tests can observe the single post-install run without a real executable
function Invoke-InstalledBinary {
  param([Parameter(Mandatory)][string[]] $Arguments)
  $global:LASTEXITCODE = 0
  # tells the binary where the diffle install is, wherever it was put
  $env:NITTLE_LEGACY_INSTALL_DIR = $LegacyBinDir
  try { & $Target @Arguments | Out-Host } catch { return 1 }
  finally { Remove-Item Env:NITTLE_LEGACY_INSTALL_DIR -ErrorAction SilentlyContinue }
  return $LASTEXITCODE
}

# a 0.28.x install made once with a custom DIFFLE_INSTALL_DIR leaves no variable behind; its dir is
# still on the user PATH. it is only trusted when it holds diffle.exe, and package-manager dirs never count
function Find-LegacyBinDir {
  if ($env:DIFFLE_INSTALL_DIR -or (Test-Path -LiteralPath $LegacyTarget)) { return $null }
  foreach ($entry in ((Get-UserPath) -split ';')) {
    $dir = [Environment]::ExpandEnvironmentVariables($entry.Trim())
    if (-not $dir -or $dir -match '(?i)scoop|winget|WindowsApps|chocolatey|Program Files') { continue }
    if (Test-Path -LiteralPath (Join-Path $dir "$LegacyName.exe")) { return $dir }
  }
  return $null
}

# the installed binary migrates data, plugins, PATH and the diffle binary on its first run; the
# installer only triggers that run, it carries none of the logic
function Invoke-LegacyMigration {
  Write-Section "Migrate $LegacyName"
  if ($DryRun) { Write-Log INFO "dry run: would run '$Name --version' so the existing $LegacyName install migrates"; return }
  Write-Log INFO "migrating the $LegacyName install in $LegacyBinDir"
  $code = Invoke-InstalledBinary -Arguments @('--version')
  if ($code -eq 0) { Write-Log OK "$LegacyName install migrated" }
  else { Write-Log WARN "'$Name --version' failed; the $LegacyName leftovers go on the next successful $Name run" }
}

# one line per deprecated DIFFLE_* variable that is standing in for an unset NITTLE_* one
foreach ($LegacyOption in 'INSTALL_DIR', 'NO_MODIFY_PATH', 'NO_SETUP', 'DRY_RUN', 'UNINSTALL', 'PATH_SCOPE_FILE') {
  if (-not [Environment]::GetEnvironmentVariable("NITTLE_$LegacyOption") -and [Environment]::GetEnvironmentVariable("DIFFLE_$LegacyOption")) {
    Write-Log INFO "DIFFLE_$LegacyOption is deprecated; used as a fallback. set NITTLE_$LegacyOption instead"
  }
}

$FoundLegacyDir = Find-LegacyBinDir
if ($FoundLegacyDir) {
  $LegacyBinDir = $FoundLegacyDir
  $LegacyTarget = Join-Path $LegacyBinDir "$LegacyName.exe"
}

try {
  if ($Uninstall) {
    Write-Section "Uninstall $Name"
    if ($DryRun) { Write-Log INFO "dry run: would remove $Target, any $LegacyName leftovers and their PATH entries" }
    else {
      if (Test-Path -LiteralPath $Target) { Invoke-AgentTeardown }
      Remove-Installed -Directory $BinDir -Executable "$Name.exe"
      Remove-Installed -Directory $LegacyBinDir -Executable "$LegacyName.exe"
    }
    Update-UserPath -Action Remove
    if (-not $DryRun) {
      Remove-EmptyDataDir $BinDir '.nittle'
      Remove-EmptyDataDir $LegacyBinDir '.diffle'
    }
    return
  }

  $Arch = switch ($env:PROCESSOR_ARCHITECTURE) {
    'ARM64' { 'arm64' }
    'AMD64' { 'x64' }
    default { throw "nittle install: unsupported architecture: $env:PROCESSOR_ARCHITECTURE" }
  }
  $Asset = "$Name-windows-$Arch.exe"
  $ApiUrl = "https://api.github.com/repos/$Repo/releases/latest"
  $Headers = @{ Accept = 'application/vnd.github+json'; 'User-Agent' = $Name }
  # ci sets GITHUB_TOKEN; authenticating dodges the anonymous rate limit shared runner ips hit
  if ($env:GITHUB_TOKEN) { $Headers.Authorization = "Bearer $env:GITHUB_TOKEN" }

  $LegacyFound = Test-LegacyInstall
  if ($LegacyFound) { Write-Log INFO "found an existing $LegacyName install" }
  Write-Section "Download $Name"
  $Release = Invoke-Step "resolving the latest $Name release" {
    try { Invoke-RestMethod -Uri $ApiUrl -Headers $Headers -ErrorAction Stop }
    catch { throw "nittle install: could not query the latest GitHub release ($($_.Exception.Message))" }
  }

  $Tag = $Release.tag_name
  if (-not $Tag) { throw 'nittle install: latest GitHub release has no tag' }
  $ReleaseAssets = @($Release.assets)
  $BinaryReleaseAsset = $ReleaseAssets | Where-Object { $_.name -ceq $Asset } | Select-Object -First 1
  $ChecksumReleaseAsset = $ReleaseAssets | Where-Object { $_.name -ceq 'checksums.txt' } | Select-Object -First 1
  if (-not $BinaryReleaseAsset -or -not $ChecksumReleaseAsset) {
    $Missing = @(
      if (-not $BinaryReleaseAsset) { $Asset }
      if (-not $ChecksumReleaseAsset) { 'checksums.txt' }
    ) -join ', '
    throw "nittle install: latest release $Tag is missing required asset(s): $Missing; no compatible nittle release is available yet"
  }
  Write-Log OK "latest release is $Tag"

  if ($DryRun) {
    Write-Log INFO "dry run: would download $Asset and verify its sha-256 against checksums.txt"
    Write-Log INFO "dry run: would install it to $Target"
    Update-UserPath -Action Add
    if ($LegacyFound) { Invoke-LegacyMigration }
    return
  }

  $Tmp = Join-Path ([IO.Path]::GetTempPath()) ('nittle-install-' + [guid]::NewGuid())
  $Staged = $null
  New-Item -ItemType Directory -Path $Tmp | Out-Null
  try {
    $BinaryPath = Join-Path $Tmp $Asset
    $ChecksumsPath = Join-Path $Tmp 'checksums.txt'
    Invoke-Step "downloading checksums.txt ($Tag)" { Save-ReleaseAsset $ChecksumReleaseAsset $ChecksumsPath }
    Invoke-Step "downloading $Asset ($Tag)" { Save-ReleaseAsset $BinaryReleaseAsset $BinaryPath }
    Write-Log OK "downloaded $Asset"

    Write-Section 'Verify'
    $Expected = Get-Content -LiteralPath $ChecksumsPath | ForEach-Object {
      if ($_ -match '^([0-9a-fA-F]{64})\s+\*?(.+)$' -and $Matches[2] -ceq $Asset) {
        $Matches[1].ToLowerInvariant()
      }
    } | Select-Object -First 1
    if (-not $Expected) { throw "nittle install: no valid checksum published for $Asset" }
    $Actual = Invoke-Step "hashing $Asset" { (Get-FileHash -LiteralPath $BinaryPath -Algorithm SHA256).Hash.ToLowerInvariant() }
    if ($Actual -ne $Expected) { throw "nittle install: checksum mismatch for $Asset" }
    Write-Log OK 'sha-256 matches the published checksum'

    Write-Section 'Install'
    New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
    $Staged = Join-Path $BinDir ".$Name.new-$PID-$([guid]::NewGuid())"
    Copy-Item -LiteralPath $BinaryPath -Destination $Staged
    Move-ExistingAside $Target
    try { Move-Item -LiteralPath $Staged -Destination $Target -Force -ErrorAction Stop }
    catch { throw "nittle install: could not replace $Target ($($_.Exception.Message)) — $StopHint, then rerun the installer" }
    $Staged = $null
    Write-Log OK "installed $Name $Tag to $Target"
  }
  finally {
    if ($Staged -and (Test-Path -LiteralPath $Staged)) { Remove-Item -LiteralPath $Staged -Force -ErrorAction SilentlyContinue }
    if (Test-Path -LiteralPath $Tmp) { Remove-Item -LiteralPath $Tmp -Recurse -Force -ErrorAction SilentlyContinue }
  }

  Update-UserPath -Action Add
  if ($LegacyFound) { Invoke-LegacyMigration }
  Write-Log INFO "run '$Name --version' in a new shell to confirm the install"
  Invoke-AgentSetupOffer
}
catch {
  Write-Log ERROR $_.Exception.Message
  throw
}
}
