# diffle installer (Windows) — downloads the matching release binary, verifies its sha-256, and
# installs it to ~\.diffle\bin. Usage:  irm https://<host>/install.ps1 | iex
$ErrorActionPreference = 'Stop'

$Repo = 'codywilliamson/loupe'   # repo not yet renamed; GitHub redirects the old path afterwards
$Name = 'diffle'
$BinDir = if ($env:DIFFLE_INSTALL_DIR) { $env:DIFFLE_INSTALL_DIR } else { Join-Path $HOME '.diffle\bin' }
$Arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }
$Asset = "$Name-windows-$Arch.exe"

$rel = Invoke-RestMethod "https://api.github.com/repos/$Repo/releases/latest" -Headers @{ 'User-Agent' = $Name }
$Tag = $rel.tag_name
if (-not $Tag) { throw 'could not resolve the latest release' }
$Base = "https://github.com/$Repo/releases/download/$Tag"

$tmp = New-Item -ItemType Directory -Path (Join-Path $env:TEMP ([guid]::NewGuid()))
try {
  Write-Host "downloading $Asset ($Tag)..."
  Invoke-WebRequest "$Base/$Asset" -OutFile (Join-Path $tmp $Asset) -UseBasicParsing
  Invoke-WebRequest "$Base/checksums.txt" -OutFile (Join-Path $tmp 'checksums.txt') -UseBasicParsing

  $line = Select-String -Path (Join-Path $tmp 'checksums.txt') -Pattern ([regex]::Escape($Asset)) | Select-Object -First 1
  if (-not $line) { throw "no checksum published for $Asset" }
  $expected = $line.Line.Split()[0].ToLower()
  $actual = (Get-FileHash (Join-Path $tmp $Asset) -Algorithm SHA256).Hash.ToLower()
  if ($actual -ne $expected) { throw "checksum mismatch for $Asset" }

  New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
  Copy-Item (Join-Path $tmp $Asset) (Join-Path $BinDir "$Name.exe") -Force
  Write-Host "installed $Name $Tag to $BinDir\$Name.exe"
  if ($env:PATH -notlike "*$BinDir*") { Write-Host "add it to your PATH:  setx PATH `"$BinDir;`$env:PATH`"" }
}
finally { Remove-Item -Recurse -Force $tmp }
