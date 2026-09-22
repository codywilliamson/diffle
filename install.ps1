# diffle installer (Windows) — downloads the matching release binary, verifies its sha-256,
# installs it to ~\.diffle\bin, and puts that directory on the user PATH.
# Usage: irm https://<host>/install.ps1 | iex
# Env knobs: DIFFLE_INSTALL_DIR, DIFFLE_DRY_RUN, DIFFLE_NO_MODIFY_PATH, DIFFLE_UNINSTALL
#Requires -Version 7.0
& {
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false

# #Requires is not enforced under `irm | iex`, so check at runtime too
if ($PSVersionTable.PSVersion.Major -lt 7) {
  throw "diffle install: PowerShell 7.0 or newer is required (found $($PSVersionTable.PSVersion))"
}

$Repo = 'codywilliamson/diffle'
$Name = 'diffle'
$BinDir = if ($env:DIFFLE_INSTALL_DIR) { $env:DIFFLE_INSTALL_DIR } else { Join-Path $HOME '.diffle\bin' }
$Target = Join-Path $BinDir "$Name.exe"
$DryRun = [bool]$env:DIFFLE_DRY_RUN
$NoModifyPath = [bool]$env:DIFFLE_NO_MODIFY_PATH
$Uninstall = [bool]$env:DIFFLE_UNINSTALL
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

# DIFFLE_PATH_SCOPE_FILE is a test seam: read/write the "user PATH" from a file, never the registry.
# The registry is read raw (DoNotExpandEnvironmentNames) so %VAR% tokens in entries we did not add
# survive verbatim — [Environment]::GetEnvironmentVariable would expand them into the stored value.
function Get-UserPath {
  if ($env:DIFFLE_PATH_SCOPE_FILE) {
    if (Test-Path -LiteralPath $env:DIFFLE_PATH_SCOPE_FILE) { return [IO.File]::ReadAllText($env:DIFFLE_PATH_SCOPE_FILE) }
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
  if ($env:DIFFLE_PATH_SCOPE_FILE) {
    [IO.File]::WriteAllText($env:DIFFLE_PATH_SCOPE_FILE, $Value)
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
    if (-not ('Diffle.NativeMethods' -as [type])) {
      Add-Type -Namespace Diffle -Name NativeMethods -MemberDefinition @'
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
    [void][Diffle.NativeMethods]::SendMessageTimeout(
      $broadcast.hWnd, $broadcast.Msg, $broadcast.wParam, $broadcast.lParam,
      $broadcast.fuFlags, $broadcast.uTimeout, [ref]$answer)
  }
  catch {
    Write-Log WARN 'could not broadcast the environment change; open apps may need a restart'
  }
}

function Test-SamePathEntry {
  param([Parameter(Mandatory)][AllowEmptyString()][string] $Entry, [Parameter(Mandatory)][string] $Directory)
  return $Entry.TrimEnd('\') -ieq $Directory.TrimEnd('\')
}

function Add-DiffleToUserPath {
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

  $backup = Join-Path ([IO.Path]::GetTempPath()) ('diffle-userpath-{0:yyyyMMdd-HHmmss}.txt' -f (Get-Date))
  [IO.File]::WriteAllText($backup, $current)
  Write-Log INFO "backed up the prior user PATH to $backup"

  # concatenate rather than split/rejoin: every existing entry stays byte for byte what it was
  Set-UserPath $(if ($current) { "$Directory;$current" } else { $Directory })
  $env:PATH = "$Directory;$env:PATH"
  Write-Log OK "added $Directory to the user PATH"
  Write-Log INFO 'other open shells need a restart to pick it up'
}

function Remove-DiffleFromUserPath {
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
    Write-Log INFO 'DIFFLE_NO_MODIFY_PATH is set; leaving the user PATH alone'
    if ($Action -eq 'Add') { Write-Log INFO "add $BinDir to your user PATH yourself to run $Name from any shell" }
    return
  }
  if ($Action -eq 'Add') { Add-DiffleToUserPath -Directory $BinDir -WhatIf:$DryRun }
  else { Remove-DiffleFromUserPath -Directory $BinDir -WhatIf:$DryRun }
}

function Save-ReleaseAsset($ReleaseAsset, $Destination) {
  try {
    Invoke-WebRequest -Uri $ReleaseAsset.browser_download_url -OutFile $Destination -UseBasicParsing -ErrorAction Stop
  }
  catch {
    throw "diffle install: failed to download $($ReleaseAsset.name) for $Tag"
  }
}

try {
  if ($Uninstall) {
    Write-Section "Uninstall $Name"
    if (Test-Path -LiteralPath $Target) {
      if ($DryRun) { Write-Log INFO "dry run: would remove $Target" }
      else {
        Remove-Item -LiteralPath $Target -Force
        Write-Log OK "removed $Target"
      }
    }
    else { Write-Log WARN "no $Name binary at $Target" }
    Update-UserPath -Action Remove
    return
  }

  $Arch = switch ($env:PROCESSOR_ARCHITECTURE) {
    'ARM64' { 'arm64' }
    'AMD64' { 'x64' }
    default { throw "diffle install: unsupported architecture: $env:PROCESSOR_ARCHITECTURE" }
  }
  $Asset = "$Name-windows-$Arch.exe"
  $ApiUrl = "https://api.github.com/repos/$Repo/releases/latest"
  $Headers = @{ Accept = 'application/vnd.github+json'; 'User-Agent' = $Name }

  Write-Section "Download $Name"
  $Release = Invoke-Step "resolving the latest $Name release" {
    try { Invoke-RestMethod -Uri $ApiUrl -Headers $Headers -ErrorAction Stop }
    catch { throw 'diffle install: could not query the latest GitHub release' }
  }

  $Tag = $Release.tag_name
  if (-not $Tag) { throw 'diffle install: latest GitHub release has no tag' }
  $ReleaseAssets = @($Release.assets)
  $BinaryReleaseAsset = $ReleaseAssets | Where-Object { $_.name -ceq $Asset } | Select-Object -First 1
  $ChecksumReleaseAsset = $ReleaseAssets | Where-Object { $_.name -ceq 'checksums.txt' } | Select-Object -First 1
  if (-not $BinaryReleaseAsset -or -not $ChecksumReleaseAsset) {
    $Missing = @(
      if (-not $BinaryReleaseAsset) { $Asset }
      if (-not $ChecksumReleaseAsset) { 'checksums.txt' }
    ) -join ', '
    throw "diffle install: latest release $Tag is missing required asset(s): $Missing; no compatible diffle release is available yet"
  }
  Write-Log OK "latest release is $Tag"

  if ($DryRun) {
    Write-Log INFO "dry run: would download $Asset and verify its sha-256 against checksums.txt"
    Write-Log INFO "dry run: would install it to $Target"
    Update-UserPath -Action Add
    return
  }

  $Tmp = Join-Path ([IO.Path]::GetTempPath()) ('diffle-install-' + [guid]::NewGuid())
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
    if (-not $Expected) { throw "diffle install: no valid checksum published for $Asset" }
    $Actual = Invoke-Step "hashing $Asset" { (Get-FileHash -LiteralPath $BinaryPath -Algorithm SHA256).Hash.ToLowerInvariant() }
    if ($Actual -ne $Expected) { throw "diffle install: checksum mismatch for $Asset" }
    Write-Log OK 'sha-256 matches the published checksum'

    Write-Section 'Install'
    New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
    $Staged = Join-Path $BinDir ".$Name.new-$PID-$([guid]::NewGuid())"
    Copy-Item -LiteralPath $BinaryPath -Destination $Staged
    Move-Item -LiteralPath $Staged -Destination $Target -Force
    $Staged = $null
    Write-Log OK "installed $Name $Tag to $Target"
  }
  finally {
    if ($Staged -and (Test-Path -LiteralPath $Staged)) { Remove-Item -LiteralPath $Staged -Force -ErrorAction SilentlyContinue }
    if (Test-Path -LiteralPath $Tmp) { Remove-Item -LiteralPath $Tmp -Recurse -Force -ErrorAction SilentlyContinue }
  }

  Update-UserPath -Action Add
  Write-Log INFO "run '$Name --version' in a new shell to confirm the install"
}
catch {
  Write-Log ERROR $_.Exception.Message
  throw
}
}
