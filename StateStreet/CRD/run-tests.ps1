param(
  [string]$TestEnv,

  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$TestFeature = @()
)

$TestEnv = $TestEnv ? $TestEnv : (Read-Host "Test environment (try 'local')")
$TestFeature = $TestFeature ? $TestFeature : @(Read-Host "Feature to run (press Enter for all features)")
$env:TEST_FEATURE = $TestFeature ? ($TestFeature -join " ") : ""
$env:FORCE_COLOR = "3"

# Build config path dynamically
$configPath = "config/env/$TestEnv.api.conf.js"

$runConfig = [ordered]@{
  testEnv = $TestEnv
  testFeature = $env:TEST_FEATURE ? $env:TEST_FEATURE : "all features"
  configPath = $configPath
}

Write-Host ($runConfig | ConvertTo-Json)

if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
  Write-Host "Environment config not found: $configPath" -ForegroundColor Red
  Write-Host "Try '-TestEnv local'." -ForegroundColor Yellow
  exit 1
}

# Run cucumber via bunx (uses local version)
bunx cucumber-js --config $configPath

# Return cucumber's real exit code (important for CI)
exit $LASTEXITCODE
