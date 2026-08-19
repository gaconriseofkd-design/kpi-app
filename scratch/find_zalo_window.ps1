$zaloProcs = Get-Process -Name Zalo -ErrorAction SilentlyContinue
foreach ($p in $zaloProcs) {
    Write-Host "Zalo Process ID: $($p.Id), Handle: $($p.MainWindowHandle), Title: '$($p.MainWindowTitle)'"
}

$mainZalo = $zaloProcs | Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } | Select-Object -First 1
if ($mainZalo) {
    Write-Host "FOUND MAIN ZALO PROCESS! ID: $($mainZalo.Id), Handle: $($mainZalo.MainWindowHandle), Title: '$($mainZalo.MainWindowTitle)'" -ForegroundColor Green
} else {
    Write-Host "No Zalo process with non-zero MainWindowHandle found!" -ForegroundColor Red
}
