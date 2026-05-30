$Port = 9999
$ProcessIds = @(
    Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique
)

if ($ProcessIds.Count -eq 0) {
    Write-Host "WireMock is not running on port $Port." -ForegroundColor Yellow
    exit 0
}

foreach ($ProcessId in $ProcessIds) {
    Stop-Process -Id $ProcessId -ErrorAction Stop
    Write-Host "Stopped WireMock process $ProcessId on port $Port." -ForegroundColor Green
}

