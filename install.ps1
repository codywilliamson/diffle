# diffle installer (Windows) — downloads the matching release binary, verifies its sha-256, and
# installs it to ~\.diffle\bin. Usage: irm https://<host>/install.ps1 | iex
& {
$ErrorActionPreference = 'Stop'

$Repo = 'codywilliamson/diffle'
$Name = 'diffle'
$BinDir = if ($env:DIFFLE_INSTALL_DIR) { $env:DIFFLE_INSTALL_DIR } else { Join-Path $HOME '.diffle\bin' }
$Arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } elseif ($env:PROCESSOR_ARCHITECTURE -eq 'AMD64') { 'x64' } else { throw "diffle install: unsupported architecture: $env:PROCESSOR_ARCHITECTURE" }
$Asset = "$Name-windows-$Arch.exe"
$ApiUrl = "https://api.github.com/repos/$Repo/releases/latest"
$Headers = @{ Accept = 'application/vnd.github+json'; 'User-Agent' = $Name }

try {
  $Release = Invoke-RestMethod -Uri $ApiUrl -Headers $Headers -ErrorAction Stop
}
catch {
  throw "diffle install: could not query the latest GitHub release"
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

$Tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("diffle-install-" + [guid]::NewGuid())
$Staged = $null
New-Item -ItemType Directory -Path $Tmp | Out-Null

function Save-ReleaseAsset($ReleaseAsset, $Destination) {
  try {
    Invoke-WebRequest -Uri $ReleaseAsset.browser_download_url -OutFile $Destination -UseBasicParsing -ErrorAction Stop
  }
  catch {
    throw "diffle install: failed to download $($ReleaseAsset.name) for $Tag"
  }
}

try {
  $BinaryPath = Join-Path $Tmp $Asset
  $ChecksumsPath = Join-Path $Tmp 'checksums.txt'
  Write-Host "downloading $Asset ($Tag)..."
  Save-ReleaseAsset $ChecksumReleaseAsset $ChecksumsPath
  Save-ReleaseAsset $BinaryReleaseAsset $BinaryPath

  $Expected = Get-Content -LiteralPath $ChecksumsPath | ForEach-Object {
    if ($_ -match '^([0-9a-fA-F]{64})\s+\*?(.+)$' -and $Matches[2] -ceq $Asset) {
      $Matches[1].ToLowerInvariant()
    }
  } | Select-Object -First 1
  if (-not $Expected) { throw "diffle install: no valid checksum published for $Asset" }
  $Actual = (Get-FileHash -LiteralPath $BinaryPath -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($Actual -ne $Expected) { throw "diffle install: checksum mismatch for $Asset" }

  New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
  $Target = Join-Path $BinDir "$Name.exe"
  $Staged = Join-Path $BinDir ".$Name.new-$PID-$([guid]::NewGuid())"
  Copy-Item -LiteralPath $BinaryPath -Destination $Staged
  Move-Item -LiteralPath $Staged -Destination $Target -Force
  $Staged = $null

  Write-Host "installed $Name $Tag to $Target"
  $PathEntries = @($env:PATH -split [System.IO.Path]::PathSeparator)
  if ($PathEntries -notcontains $BinDir) { Write-Host "add it to your PATH:  setx PATH `"$BinDir;`$env:PATH`"" }
}
finally {
  if ($Staged -and (Test-Path -LiteralPath $Staged)) { Remove-Item -LiteralPath $Staged -Force -ErrorAction SilentlyContinue }
  if (Test-Path -LiteralPath $Tmp) { Remove-Item -LiteralPath $Tmp -Recurse -Force -ErrorAction SilentlyContinue }
}
}
