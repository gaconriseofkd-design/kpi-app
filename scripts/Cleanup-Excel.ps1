# scripts/Cleanup-Excel.ps1
param([switch]$ManualTrigger)

try {
    # 1. Kill completely hidden (zombie) Excel processes
    Get-Process Excel -ErrorAction SilentlyContinue | Where-Object { [string]::IsNullOrWhiteSpace($_.MainWindowTitle) } | Stop-Process -Force
} catch {}
