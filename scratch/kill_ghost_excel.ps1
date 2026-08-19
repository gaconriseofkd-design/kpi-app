Get-Process Excel -ErrorAction SilentlyContinue | ForEach-Object {
    if ($_.MainWindowHandle -eq 0) {
        Write-Host "Killing ghost Excel process ID: $($_.Id)"
        Stop-Process -Id $_.Id -Force
    }
}
