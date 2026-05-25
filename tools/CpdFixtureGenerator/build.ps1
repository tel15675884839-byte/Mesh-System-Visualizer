param(
  [string]$OutputDir = (Join-Path $PSScriptRoot 'bin')
)

$ErrorActionPreference = 'Stop'

$cscCandidates = @(
  "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe",
  "$env:WINDIR\Microsoft.NET\Framework\v4.0.30319\csc.exe"
)

$csc = $cscCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $csc) {
  throw 'Could not find .NET Framework csc.exe.'
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$source = Join-Path $PSScriptRoot 'CpdFixtureGenerator.cs'
$output = Join-Path $OutputDir 'CpdFixtureGenerator.exe'

& $csc /nologo /target:exe /platform:anycpu /reference:System.dll /reference:System.Core.dll /reference:System.Data.dll /out:$output $source
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host "Built $output"
