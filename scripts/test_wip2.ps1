$WIP_EXCEL_PATH = "C:\Users\prod.public\wip_test.xlsb"
$excelWIP = New-Object -ComObject Excel.Application
$excelWIP.Visible = $false
$excelWIP.DisplayAlerts = $false
try {
    $wbWIP = $excelWIP.Workbooks.Open($WIP_EXCEL_PATH, 0, $true)
    $shWIP = $wbWIP.Sheets.Item("Record Wip")
    
    $lastRow = $shWIP.Cells.Item($shWIP.Rows.Count, 1).End(-4162).Row
    if ($lastRow -lt 1) { $lastRow = 1 }
    
    while ($lastRow -gt 1) {
        $hasData = $false
        for ($c = 2; $c -le 8; $c++) {
            $valText = $shWIP.Cells.Item($lastRow, $c).Text
            $valNum = 0
            if (-not [string]::IsNullOrWhiteSpace($valText)) {
                $valText = $valText -replace '[^\d\.-]', ''
                if ($valText -and [double]::TryParse($valText, [ref]$valNum) -and $valNum -gt 0) {
                    $hasData = $true
                    break
                }
            }
        }
        if ($hasData) { break }
        $lastRow--
    }

    Write-Host "Chosen Last Row: $lastRow"
    
    $rowStr = "Row $lastRow :"
    for ($c = 1; $c -le 8; $c++) {
        $val = $shWIP.Cells.Item($lastRow, $c).Text
        $rowStr += " [$val]"
    }
    Write-Host $rowStr
    
} finally {
    if ($wbWIP) { $wbWIP.Close($false) }
    $excelWIP.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excelWIP) | Out-Null
}
