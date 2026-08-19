$parent = Get-ChildItem "C:\Users\prod.public\Ortholite Vietnam\OVN Production - Documents\PRODUCTION\" -Filter "Nh*n Lg" | Select-Object -First 1
$path = Join-Path $parent.FullName "Schedule\Ovn Pro Schedule.xlsb"

Write-Host "Target File: $path"
if (Test-Path $path) {
    Write-Host "File EXISTS!"
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    try {
        $wb = $excel.Workbooks.Open($path, 0, $true)
        Write-Host "=== ALL SHEETS IN WORKBOOK ==="
        for ($idx = 1; $idx -le $wb.Sheets.Count; $idx++) {
            $sName = $wb.Sheets.Item($idx).Name
            Write-Host "Sheet $idx : [$sName]"
        }
        
        foreach ($sh in $wb.Sheets) {
            Write-Host "`n=========================================="
            Write-Host "--- SHEET: $($sh.Name) ---"
            Write-Host "=========================================="
            for ($r = 1; $r -le 15; $r++) {
                $rowStr = "R$r :"
                for ($c = 1; $c -le 8; $c++) {
                    $val = $sh.Cells.Item($r, $c).Text
                    if ($val) { $val = $val.Trim() }
                    $rowStr += " [$val]"
                }
                Write-Host $rowStr
            }
        }
        
        $wb.Close($false)
    } finally {
        $excel.Quit()
        [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
    }
} else {
    Write-Host "File NOT found: $path"
}
