$excelPath = "c:\Users\prod.public\Ortholite Vietnam\OVN Production - Documents\PRODUCTION\TRUONG OFFICE\PROJECT\KPI APP\APP KPI\% OT.xlsx"

if (-not (Test-Path $excelPath)) {
    Write-Host "Khong tim thay file: $excelPath" -ForegroundColor Red
    exit 1
}

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

try {
    Write-Host "Opening $excelPath..." -ForegroundColor Cyan
    $wb = $excel.Workbooks.Open($excelPath, 0, $true) # Open read-only for inspection
    
    Write-Host "=== SHEETS IN WORKBOOK ==="
    foreach ($sh in $wb.Sheets) {
        Write-Host "Sheet: '$($sh.Name)'"
    }
    
    # Check sheet ControlManhour5
    try {
        $shControl = $wb.Sheets.Item("ControlManhour5")
        Write-Host "Found sheet ControlManhour5. QueryTables count: $($shControl.QueryTables.Count), ListObjects count: $($shControl.ListObjects.Count)"
        foreach ($lo in $shControl.ListObjects) {
            Write-Host "  ListObject: '$($lo.Name)', Range: '$($lo.Range.Address)'"
        }
    } catch {
        Write-Host "Loi doc sheet ControlManhour5: $_" -ForegroundColor Red
    }
    
    # Check sheet Sheet2 and PivotTable1
    try {
        $shSheet2 = $wb.Sheets.Item("Sheet2")
        Write-Host "Found sheet Sheet2. PivotTables count: $($shSheet2.PivotTables().Count)"
        foreach ($pt in $shSheet2.PivotTables()) {
            Write-Host "  PivotTable Name: '$($pt.Name)', TableRange1: '$($pt.TableRange1.Address)', TableRange2: '$($pt.TableRange2.Address)'"
        }
    } catch {
        Write-Host "Loi doc sheet Sheet2: $_" -ForegroundColor Red
    }
    
    $wb.Close($false)
} finally {
    $excel.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
}
