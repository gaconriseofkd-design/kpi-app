$excelPath = "c:\Users\prod.public\Ortholite Vietnam\OVN Production - Documents\PRODUCTION\TRUONG OFFICE\PROJECT\KPI APP\APP KPI\% OT.xlsx"
$imgPath = "c:\Users\prod.public\Ortholite Vietnam\OVN Production - Documents\PRODUCTION\TRUONG OFFICE\PROJECT\KPI APP\APP KPI\scratch\pivot1_export.png"

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

try {
    Write-Host "Opening $excelPath..." -ForegroundColor Cyan
    $wb = $excel.Workbooks.Open($excelPath)
    
    # 1. Refresh sheet ControlManhour5 / Workbook data connections
    Write-Host "Refreshing workbook connections & tables..." -ForegroundColor Cyan
    try {
        $shControl = $wb.Sheets.Item("ControlManhour5")
        foreach ($lo in $shControl.ListObjects) {
            try { $lo.QueryTable.Refresh($false) } catch {}
        }
    } catch {}
    
    $wb.RefreshAll()
    # Wait for async background refreshes to complete if any
    $excel.CalculateUntilAsyncQueriesDone()
    
    # 2. Refresh PivotTable1 in Sheet2
    Write-Host "Refreshing PivotTable1 in Sheet2..." -ForegroundColor Cyan
    $shSheet2 = $wb.Sheets.Item("Sheet2")
    $pt1 = $shSheet2.PivotTables("PivotTable1")
    $pt1.Update()
    
    # Range of PivotTable1
    $ptRange = $pt1.TableRange2
    if (-not $ptRange) { $ptRange = $pt1.TableRange1 }
    
    Write-Host "PivotTable1 Address: $($ptRange.Address)" -ForegroundColor Green
    
    # 3. Export Range as Image
    # Method A: CopyPicture & Clipboard
    $ptRange.CopyPicture(1, 2) # xlScreen = 1, xlBitmap = 2
    Start-Sleep -Milliseconds 500
    
    if ([System.Windows.Forms.Clipboard]::ContainsImage()) {
        $img = [System.Windows.Forms.Clipboard]::GetImage()
        $img.Save($imgPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $img.Dispose()
        Write-Host "Successfully saved image to: $imgPath" -ForegroundColor Green
    } else {
        Write-Host "Clipboard does not contain image, trying Chart export method..." -ForegroundColor Yellow
        # Method B: Temporary Chart Object
        $ptRange.Copy()
        $chartObj = $shSheet2.ChartObjects().Add($ptRange.Left, $ptRange.Top, $ptRange.Width, $ptRange.Height)
        $chartObj.Chart.Paste()
        $chartObj.Chart.Export($imgPath, "PNG")
        $chartObj.Delete()
        Write-Host "Chart export finished: $imgPath" -ForegroundColor Green
    }
    
    $wb.Close($false)
} finally {
    $excel.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
}
