$WIP_EXCEL_PATH = "C:\Users\prod.public\wip_test.xlsb"
$excelWIP = New-Object -ComObject Excel.Application
$excelWIP.Visible = $false
$excelWIP.DisplayAlerts = $false
try {
    $wbWIP = $excelWIP.Workbooks.Open($WIP_EXCEL_PATH, 0, $true)
    $shWIP = $wbWIP.Sheets.Item("Record Wip")
    
    $lastRow = $shWIP.Cells.Item($shWIP.Rows.Count, 1).End(-4162).Row
    if ($lastRow -lt 1) { $lastRow = 1 }
    
    $today = (Get-Date).Date
    $closestRow = -1
    $minDiffDays = 999999
    $closestDate = $null

    for ($r = 2; $r -le $lastRow; $r++) {
        $dateText = $shWIP.Cells.Item($r, 1).Text
        $dateVal = $null
        try {
            $dateVal = [datetime]::Parse($dateText)
        } catch {
            $dateVal = $null
        }
        
        if ($dateVal) {
            # Check if this row has actual data
            $hasData = $false
            for ($c = 2; $c -le 8; $c++) {
                $valText = $shWIP.Cells.Item($r, $c).Text
                $valNum = 0
                if (-not [string]::IsNullOrWhiteSpace($valText)) {
                    $valText = $valText -replace '[^\d\.-]', ''
                    if ($valText -and [double]::TryParse($valText, [ref]$valNum) -and $valNum -gt 0) {
                        $hasData = $true
                        break
                    }
                }
            }
            
            if ($hasData) {
                $diffDays = [math]::Abs(($today - $dateVal.Date).TotalDays)
                if ($diffDays -lt $minDiffDays) {
                    $minDiffDays = $diffDays
                    $closestRow = $r
                    $closestDate = $dateVal
                }
                elseif ($diffDays -eq $minDiffDays -and $dateVal -gt $closestDate) {
                    $closestRow = $r
                    $closestDate = $dateVal
                }
            }
        }
    }

    Write-Host "Closest Row: $closestRow"
    if ($closestRow -gt 0) {
        $rowStr = "Row $closestRow ($($closestDate.ToString('yyyy-MM-dd'))):"
        for ($c = 1; $c -le 8; $c++) {
            $val = $shWIP.Cells.Item($closestRow, $c).Text
            $rowStr += " [$val]"
        }
        Write-Host $rowStr
    }
} finally {
    if ($wbWIP) { $wbWIP.Close($false) }
    $excelWIP.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excelWIP) | Out-Null
}
