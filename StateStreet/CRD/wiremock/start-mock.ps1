$Arguments = @(
    "wiremock"
    "--port", "9999"
    "--root-dir", $PSScriptRoot
    "--local-response-templating"
    "--max-request-journal-entries", "10000"
    "--disable-gzip"
    "--max-template-cache-entries", "0"
)

npx @Arguments
