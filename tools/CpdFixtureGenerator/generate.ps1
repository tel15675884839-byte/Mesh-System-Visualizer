param(
  [string]$ConfiguratorDir = (Join-Path $PSScriptRoot '..\..\..\..\Configurator_v3.6.0_2025-12-24'),
  [string]$OutputDir = (Join-Path $PSScriptRoot '..\..\fixtures\cpd'),
  [switch]$List
)

$ErrorActionPreference = 'Stop'

& (Join-Path $PSScriptRoot 'build.ps1')
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

$exe = Join-Path $PSScriptRoot 'bin\CpdFixtureGenerator.exe'
$args = @('--configurator', (Resolve-Path -LiteralPath $ConfiguratorDir).Path, '--output', $OutputDir)
if ($List) {
  $args += '--list'
}

& $exe @args
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
