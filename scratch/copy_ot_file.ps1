$src = "c:\Users\prod.public\Ortholite Vietnam\OVN Production - Documents\PRODUCTION\TRUONG OFFICE\PROJECT\KPI APP\APP KPI\% OT.xlsx"
$dst = "c:\Users\prod.public\Ortholite Vietnam\OVN Production - Documents\PRODUCTION\TRUONG OFFICE\PROJECT\KPI APP\APP KPI\scratch\OT_temp.xlsx"

try {
    $inStream = [System.IO.File]::Open($src, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
    $outStream = [System.IO.File]::Create($dst)
    $inStream.CopyTo($outStream)
    $inStream.Close()
    $outStream.Close()
    Write-Host "Successfully copied to temp file: $dst" -ForegroundColor Green
    
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    try {
        $wb = $excel.Workbooks.Open($dst, 0, $true)
        Write-Host "Successfully opened temp file in Excel!" -ForegroundColor Green
        Write-Host "=== SHEETS IN WORKBOOK ==="
        foreach ($sh in $wb.Sheets) {
            Write-Host "Sheet: '$($sh.Name)'"
        }
        
        try {
            $shSheet2 = $wb.Sheets.Item("Sheet2")
            Write-Host "Sheet2 PivotTables count: $($shSheet2.PivotTables().Count)"
            foreach ($pt in $shSheet2.PivotTables()) {
                Write-Host "  PivotTable: Name='$($pt.Name)', Address='$($pt.TableRange1.Address)'"
            }
        } catch {
            Write-Host "Loi Sheet2: $_"
        }
        
        try {
            $shControl = $wb.Sheets.Item("ControlManhour5")
            Write-Host "ControlManhour5 PivotTables count: $($shControl.PivotTables().Count)"
        } catch {
            Write-Host "Loi ControlManhour5: $_"
        }
        
        $wb.Close($false)
    } finally {
        $excel.Quit()
        [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
    }
} catch {
    Write-Host "Loi copy file: $_" -ForegroundColor Red
}
