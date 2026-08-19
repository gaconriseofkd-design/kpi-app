$excelPath = "c:\Users\prod.public\Ortholite Vietnam\OVN Production - Documents\PRODUCTION\TRUONG OFFICE\PROJECT\KPI APP\APP KPI\% OT.xlsx"

try {
    $excel = [System.Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
    Write-Host "Found running Excel application!" -ForegroundColor Green
} catch {
    Write-Host "No active Excel object found via GetActiveObject, starting new..." -ForegroundColor Yellow
    $excel = New-Object -ComObject Excel.Application
}

$wb = $null
foreach ($w in $excel.Workbooks) {
    if ($w.FullName -like "*% OT.xlsx*") {
        $wb = $w
        Write-Host "Found already open workbook: $($wb.FullName)" -ForegroundColor Green
        break
    }
}

if (-not $wb) {
    Write-Host "Opening workbook directly..." -ForegroundColor Cyan
    $wb = $excel.Workbooks.Open($excelPath, 0, $true)
}

try {
    Write-Host "=== SHEETS IN WORKBOOK ==="
    foreach ($sh in $wb.Sheets) {
        Write-Host "Sheet: '$($sh.Name)'"
    }
    
    # Sheet ControlManhour5
    try {
        $shControl = $wb.Sheets.Item("ControlManhour5")
        Write-Host "Sheet ControlManhour5: PivotTables count = $($shControl.PivotTables().Count), ListObjects = $($shControl.ListObjects.Count)"
    } catch {
        Write-Host "Loi sheet ControlManhour5: $_"
    }
    
    # Sheet Sheet2
    try {
        $shSheet2 = $wb.Sheets.Item("Sheet2")
        Write-Host "Sheet Sheet2: PivotTables count = $($shSheet2.PivotTables().Count)"
        foreach ($pt in $shSheet2.PivotTables()) {
            Write-Host "  PivotTable Name: '$($pt.Name)', Address: '$($pt.TableRange1.Address)'"
        }
    } catch {
        Write-Host "Loi sheet Sheet2: $_"
    }
} finally {
    # Don't close $wb if it was already open by user
}
