$VerboseWireMock = $args -contains "-VerboseWireMock"

$Arguments = @(
    "wiremock"
    "--port", "9999"
    "--root-dir", $PSScriptRoot
    "--local-response-templating"
    "--max-request-journal-entries", "10000"
    "--disable-gzip"
    "--max-template-cache-entries", "0"
)

if ($VerboseWireMock) {
    $Arguments += "--verbose"
}

$LogPath = Join-Path $PSScriptRoot "wiremock.log"

npx @Arguments 2>&1 | Tee-Object -FilePath $LogPath -Append
