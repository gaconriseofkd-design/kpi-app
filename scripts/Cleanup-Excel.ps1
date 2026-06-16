# scripts/Cleanup-Excel.ps1
param([switch]$ManualTrigger)

try {
    # 1. Kill completely hidden (zombie) Excel processes
    Get-Process Excel -ErrorAction SilentlyContinue | Where-Object { [string]::IsNullOrWhiteSpace($_.MainWindowTitle) } | Stop-Process -Force

    # 2. Close stranded hidden workbooks in active/shared Excel processes
    $excelCOM = [System.Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
    if ($excelCOM) {
        foreach ($wb in $excelCOM.Workbooks) {
            if ($wb.Name -match "Powerapp|Ovn Pro Schedule|Report Lỗi thao tác supp") {
                $wb.Close($false)
            }
        }
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excelCOM) | Out-Null
    }
} catch {}
