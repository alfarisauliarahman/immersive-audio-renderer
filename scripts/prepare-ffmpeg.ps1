$ErrorActionPreference = "Stop"

$assetUrl = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-n8.1-latest-win64-lgpl-8.1.zip"
$expectedSha256 = "e05564dd43f25170e7532508394fc54d1c52fe7bd19c1773280abf2885039350"
$repoRoot = Split-Path -Parent $PSScriptRoot
$destination = Join-Path $repoRoot "src-tauri\bin"
$tempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$work = Join-Path $tempRoot ("immersive-audio-renderer-ffmpeg-8.1-" + [guid]::NewGuid().ToString("N"))
$archive = Join-Path $work "ffmpeg-lgpl.zip"
$expanded = Join-Path $work "expanded"

try {
  New-Item -ItemType Directory -Force -Path $work, $destination | Out-Null
  Invoke-WebRequest -Uri $assetUrl -OutFile $archive
  $actualSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $archive).Hash.ToLowerInvariant()
  if ($actualSha256 -ne $expectedSha256) {
    throw "FFmpeg archive checksum mismatch. Expected $expectedSha256, got $actualSha256."
  }

  Expand-Archive -LiteralPath $archive -DestinationPath $expanded
  $package = Get-ChildItem -LiteralPath $expanded -Directory | Select-Object -First 1
  if (-not $package) { throw "The FFmpeg archive has no package directory." }

  Copy-Item -LiteralPath (Join-Path $package.FullName "bin\ffmpeg.exe") -Destination (Join-Path $destination "ffmpeg-x86_64-pc-windows-msvc.exe") -Force
  Copy-Item -LiteralPath (Join-Path $package.FullName "bin\ffprobe.exe") -Destination (Join-Path $destination "ffprobe-x86_64-pc-windows-msvc.exe") -Force
  Copy-Item -LiteralPath (Join-Path $package.FullName "LICENSE.txt") -Destination (Join-Path $destination "FFMPEG-LICENSE.txt") -Force

  Write-Host "Prepared verified FFmpeg 8.1 LGPL sidecars in $destination"
}
finally {
  if (Test-Path -LiteralPath $work) {
    $resolvedWork = [System.IO.Path]::GetFullPath((Resolve-Path -LiteralPath $work).Path)
    if ($resolvedWork.StartsWith($tempRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
      Remove-Item -LiteralPath $resolvedWork -Recurse -Force
    }
  }
}
