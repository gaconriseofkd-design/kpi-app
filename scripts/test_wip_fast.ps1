$WIP_EXCEL_PATH = "C:\Users\prod.public\wip_test.xlsb"
$excelWIP = New-Object -ComObject Excel.Application
$excelWIP.Visible = $false
$excelWIP.DisplayAlerts = $false
try {
    $wbWIP = $excelWIP.Workbooks.Open($WIP_EXCEL_PATH, 0, $true)
    $shWIP = $wbWIP.Sheets.Item("Record Wip")
    
    $lastRow = $shWIP.Cells.Item($shWIP.Rows.Count, 1).End(-4162).Row
    if ($lastRow -lt 2) { $lastRow = 2 }
    
    # Extract data into a 2D array
    $range = $shWIP.Range("A1:H$lastRow")
    $values = $range.Value2
    
    $today = (Get-Date).Date
    $closestRow = -1
    $minDiffDays = 999999
    $closestDate = $null

    for ($r = 2; $r -le $lastRow; $r++) {
        $dateVal2 = $values[$r, 1]
        $dateVal = $null
        
        # In Excel Value2, dates are usually doubles (OADate)
        if ($dateVal2 -is [double]) {
            try { $dateVal = [datetime]::FromOADate($dateVal2) } catch {}
        } elseif ($dateVal2 -is [string]) {
            try { $dateVal = [datetime]::Parse($dateVal2) } catch {}
        }
        
        if ($dateVal) {
            # Check if this row has actual data
            $hasData = $false
            for ($c = 2; $c -le 8; $c++) {
                $valStr = [string]$values[$r, $c]
                $valNum = 0
                if (-not [string]::IsNullOrWhiteSpace($valStr)) {
                    $valStr = $valStr -replace '[^\d\.-]', ''
                    if ($valStr -and [double]::TryParse($valStr, [ref]$valNum) -and $valNum -gt 0) {
                        $hasData = $true
                        break
                    }
                }
            }
            
            if ($hasData) {
                # We only want dates <= today
                if ($dateVal.Date -le $today) {
                    $diffDays = ($today - $dateVal.Date).TotalDays
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
    }

    Write-Host "Closest Row: $closestRow"
    if ($closestRow -gt 0) {
        $rowStr = "Row $closestRow ($($closestDate.ToString('yyyy-MM-dd'))):"
        for ($c = 1; $c -le 8; $c++) {
            $val = $values[$closestRow, $c]
            $rowStr += " [$val]"
        }
        Write-Host $rowStr
    }
} finally {
    if ($wbWIP) { $wbWIP.Close($false) }
    $excelWIP.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excelWIP) | Out-Null
}
