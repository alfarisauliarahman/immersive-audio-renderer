param(
  [Parameter(Mandatory = $true)] [string] $InstallerPath,
  [Parameter(Mandatory = $true)] [string] $SignaturePath,
  [Parameter(Mandatory = $true)] [string] $OutputDirectory,
  [string] $Version = "0.1.0"
)

$ErrorActionPreference = "Stop"
$installer = Get-Item -LiteralPath $InstallerPath
$signature = (Get-Content -Raw -LiteralPath $SignaturePath).Trim()
if (-not $signature) { throw "The updater signature is empty." }

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$assetName = "Immersive-Audio-Renderer_${Version}_x64-setup.exe"
$assetPath = Join-Path $OutputDirectory $assetName
$signatureOutput = "$assetPath.sig"
Copy-Item -LiteralPath $installer.FullName -Destination $assetPath -Force
Copy-Item -LiteralPath $SignaturePath -Destination $signatureOutput -Force

$assetUrl = "https://github.com/alfarisauliarahman/immersive-audio-renderer-releases/releases/download/v$Version/$assetName"
$manifest = [ordered]@{
  version = $Version
  notes = "Signed Windows installer with bundled FFmpeg/ffprobe 8.1 LGPL and OpenJOC 0.7.0."
  pub_date = (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", [System.Globalization.CultureInfo]::InvariantCulture)
  platforms = [ordered]@{
    "windows-x86_64" = [ordered]@{
      signature = $signature
      url = $assetUrl
    }
  }
}
$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $OutputDirectory "latest.json") -Encoding utf8NoBOM

$files = @($assetPath, $signatureOutput, (Join-Path $OutputDirectory "latest.json"))
$checksumLines = foreach ($file in $files) {
  $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $file).Hash.ToLowerInvariant()
  "$hash  $([System.IO.Path]::GetFileName($file))"
}
$checksumLines | Set-Content -LiteralPath (Join-Path $OutputDirectory "SHA256SUMS.txt") -Encoding ascii

Write-Host "Prepared release artifacts in $OutputDirectory"
