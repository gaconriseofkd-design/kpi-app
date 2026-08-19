$path = "c:\Users\prod.public\Ortholite Vietnam\OVN Production - Documents\PRODUCTION\TRUONG OFFICE\PROJECT\KPI APP\APP KPI\% OT.xlsx"

try {
    $wb = [System.Runtime.InteropServices.Marshal]::BindToMoniker($path)
    Write-Host "SUCCESS! Bound to running workbook via Moniker: $($wb.FullName)" -ForegroundColor Green
    Write-Host "=== SHEETS ==="
    foreach ($sh in $wb.Sheets) {
        Write-Host "Sheet: '$($sh.Name)'"
    }
    
    try {
        $sh2 = $wb.Sheets.Item("Sheet2")
        Write-Host "Sheet2 PivotTables count: $($sh2.PivotTables().Count)"
        foreach ($pt in $sh2.PivotTables()) {
            Write-Host "  PivotTable Name: '$($pt.Name)'"
            Write-Host "  TableRange1: '$($pt.TableRange1.Address)'"
            Write-Host "  TableRange2: '$($pt.TableRange2.Address)'"
        }
    } catch {
        Write-Host "Loi Sheet2: $_"
    }
    
    try {
        $shControl = $wb.Sheets.Item("ControlManhour5")
        Write-Host "ControlManhour5 Name: '$($shControl.Name)'"
    } catch {
        Write-Host "Loi ControlManhour5: $_"
    }

} catch {
    Write-Host "BindToMoniker failed: $_" -ForegroundColor Red
}
