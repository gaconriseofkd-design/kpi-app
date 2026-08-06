$WIP_EXCEL_PATH = "C:\Users\prod.public\wip_test.xlsb"
$excelWIP = New-Object -ComObject Excel.Application
$excelWIP.Visible = $false
$excelWIP.DisplayAlerts = $false
try {
    $wbWIP = $excelWIP.Workbooks.Open($WIP_EXCEL_PATH, 0, $true)
    $shWIP = $wbWIP.Sheets.Item("Record Wip")
    
    $lastRow = $shWIP.Cells.Item($shWIP.Rows.Count, 1).End(-4162).Row
    if ($lastRow -lt 1) { $lastRow = 1 }
    
    Write-Host "Last Row from Col 1: $lastRow"
    
    $startRow = [math]::Max(1, $lastRow - 10)
    for ($r = $startRow; $r -le ($lastRow + 2); $r++) {
        $rowStr = "Row $r :"
        for ($c = 1; $c -le 8; $c++) {
            $val = $shWIP.Cells.Item($r, $c).Text
            $rowStr += " [$val]"
        }
        Write-Host $rowStr
    }
} finally {
    if ($wbWIP) { $wbWIP.Close($false) }
    $excelWIP.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excelWIP) | Out-Null
}
