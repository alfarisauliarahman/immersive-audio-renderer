param(
  [Parameter(Mandatory = $true)] [string] $ApplicationPath,
  [Parameter(Mandatory = $true)] [string] $OutputPath,
  [string] $Version = "0.1.0"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$bin = Join-Path $repoRoot "src-tauri\bin"
$tempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$work = Join-Path $tempRoot ("immersive-audio-renderer-portable-" + [guid]::NewGuid().ToString("N"))
$package = Join-Path $work "Immersive Audio Renderer"

try {
  New-Item -ItemType Directory -Force -Path $package, (Join-Path $package "bin") | Out-Null
  Copy-Item -LiteralPath $ApplicationPath -Destination (Join-Path $package "Immersive Audio Renderer.exe")
  Copy-Item -LiteralPath (Join-Path $bin "ffmpeg-x86_64-pc-windows-msvc.exe") -Destination (Join-Path $package "ffmpeg.exe")
  Copy-Item -LiteralPath (Join-Path $bin "ffprobe-x86_64-pc-windows-msvc.exe") -Destination (Join-Path $package "ffprobe.exe")
  Copy-Item -LiteralPath (Join-Path $bin "openjoc-x86_64-pc-windows-msvc.exe") -Destination (Join-Path $package "openjoc.exe")
  Copy-Item -LiteralPath (Join-Path $bin "FFMPEG-BUILD.txt") -Destination (Join-Path $package "bin\FFMPEG-BUILD.txt")
  Copy-Item -LiteralPath (Join-Path $bin "FFMPEG-LICENSE.txt") -Destination (Join-Path $package "bin\FFMPEG-LICENSE.txt")
  Copy-Item -LiteralPath (Join-Path $bin "OPENJOC-LICENSE.txt") -Destination (Join-Path $package "bin\OPENJOC-LICENSE.txt")
  Copy-Item -LiteralPath (Join-Path $repoRoot "LICENSE") -Destination (Join-Path $package "LICENSE")
  Copy-Item -LiteralPath (Join-Path $repoRoot "THIRD_PARTY_NOTICES.md") -Destination (Join-Path $package "THIRD_PARTY_NOTICES.md")

  $readme = @"
Immersive Audio Renderer v$Version - Portable Windows x64

1. Extract the complete ZIP before running the application.
2. Keep every EXE and the bin folder together.
3. Run "Immersive Audio Renderer.exe". No separate FFmpeg/OpenJOC install is needed.
4. Microsoft Edge WebView2 is required and is normally already installed on Windows.

The portable distribution does not check for or install updates automatically.
Download and extract a newer portable ZIP manually from the public release page:
https://github.com/alfarisauliarahman/immersive-audio-renderer-releases/releases

No demo music, private fixture, user master, or Dolby website media is included.
See LICENSE and THIRD_PARTY_NOTICES.md for licensing details.
"@
  Set-Content -LiteralPath (Join-Path $package "PORTABLE-README.txt") -Value $readme -Encoding utf8NoBOM

  $outputDirectory = Split-Path -Parent ([System.IO.Path]::GetFullPath($OutputPath))
  New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
  if (Test-Path -LiteralPath $OutputPath) { Remove-Item -LiteralPath $OutputPath -Force }
  Compress-Archive -LiteralPath $package -DestinationPath $OutputPath -CompressionLevel Optimal
  Write-Host "Created portable package at $OutputPath"
}
finally {
  if (Test-Path -LiteralPath $work) {
    $resolvedWork = [System.IO.Path]::GetFullPath((Resolve-Path -LiteralPath $work).Path)
    if ($resolvedWork.StartsWith($tempRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
      Remove-Item -LiteralPath $resolvedWork -Recurse -Force
    }
  }
}
