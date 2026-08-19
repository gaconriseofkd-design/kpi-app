$parent = Get-ChildItem "C:\Users\prod.public\Ortholite Vietnam\OVN Production - Documents\PRODUCTION\" -Filter "Nh*n Lg" | Select-Object -First 1
$WIP_EXCEL_PATH = Join-Path $parent.FullName "Schedule\Ovn Pro Schedule.xlsb"

if (-not (Test-Path $WIP_EXCEL_PATH)) {
    Write-Host "Khong tim thay file Excel: $WIP_EXCEL_PATH" -ForegroundColor Red
    exit 1
}

$excelWIP = New-Object -ComObject Excel.Application
$excelWIP.Visible = $false
$excelWIP.DisplayAlerts = $false

$laminationNew = 0
$leanDcNew = 0
$prefittingNew = 0
$moldingNew = 0
$leanMoldedNew = 0
$wipValues = @()

try {
    $wbWIP = $excelWIP.Workbooks.Open($WIP_EXCEL_PATH, 0, $true)
    
    # 1. Đọc sheet Record Wip (Old) / Record Wip cho báo cáo WIP cũ
    $shWIP = $null
    try { $shWIP = $wbWIP.Sheets.Item("Record Wip (Old)") } catch {}
    if (-not $shWIP) {
        try { $shWIP = $wbWIP.Sheets.Item("Record Wip") } catch {}
    }
    
    if ($shWIP) {
        $wipRows = @(2, 3, 5, 6, 8, 9, 10)
        foreach ($wipRow in $wipRows) {
            $lastCol = $shWIP.UsedRange.Columns.Count
            for ($c = $lastCol; $c -ge 1; $c--) {
                $valText = $shWIP.Cells.Item($wipRow, $c).Text
                if (-not [string]::IsNullOrWhiteSpace($valText)) { break }
            }
            $valText = $shWIP.Cells.Item($wipRow, $c).Text
            $valNum = 0
            if (-not [string]::IsNullOrWhiteSpace($valText)) {
                $valText = $valText -replace '[^\d\.-]', ''
                if ($valText) { [double]::TryParse($valText, [ref]$valNum) | Out-Null }
            }
            $wipValues += $valNum
        }
    }
    
    # 2. Đọc sheet RECORD WIP cho báo cáo WIP NEW TARGET
    $shRecordWip = $null
    try { $shRecordWip = $wbWIP.Sheets.Item("RECORD WIP") } catch {}
    if (-not $shRecordWip) {
        try { $shRecordWip = $wbWIP.Sheets.Item("Record Wip") } catch {}
    }
    
    if ($shRecordWip) {
        for ($c = 1; $c -le 10; $c++) {
            $secName = ($shRecordWip.Cells.Item(1, $c).Text + " " + $shRecordWip.Cells.Item(4, $c).Text).Trim()
            $valText = $shRecordWip.Cells.Item(2, $c).Text
            $valNum = 0
            if (-not [string]::IsNullOrWhiteSpace($valText)) {
                $valText = $valText -replace '[^\d\.-]', ''
                if ($valText) { [double]::TryParse($valText, [ref]$valNum) | Out-Null }
            }
            
            if ($secName -like "*1.MATERIAL*" -or $secName -like "*LAMINATION*") {
                $laminationNew = $valNum
            } elseif ($secName -like "*2.WIP*" -or $secName -like "*DIE CUT*" -or $secName -like "*Leanline DC*") {
                $leanDcNew = $valNum
            } elseif ($secName -like "*3.WIP*" -or $secName -like "*PREFITTING*" -or $secName -like "*Prefitting*") {
                $prefittingNew = $valNum
            } elseif ($secName -like "*4.WIP*" -or ($secName -like "*MOLDING*" -and $secName -notlike "*LEAN*")) {
                $moldingNew = $valNum
            } elseif ($secName -like "*5.WIP*" -or $secName -like "*LEAN LINE MOLDED*" -or $secName -like "*Leanline Molded*") {
                $leanMoldedNew = $valNum
            }
        }
        
        if ($laminationNew -eq 0 -and $leanDcNew -eq 0 -and $prefittingNew -eq 0 -and $moldingNew -eq 0 -and $leanMoldedNew -eq 0) {
            for ($r = 2; $r -le 10; $r++) {
                $secName = $shRecordWip.Cells.Item($r, 1).Text
                $valText = $shRecordWip.Cells.Item($r, 2).Text
                $valNum = 0
                if (-not [string]::IsNullOrWhiteSpace($valText)) {
                    $valText = $valText -replace '[^\d\.-]', ''
                    if ($valText) { [double]::TryParse($valText, [ref]$valNum) | Out-Null }
                }
                
                if ($secName -like "*1.MATERIAL*" -or $secName -like "*LAMINATION*") {
                    $laminationNew = $valNum
                } elseif ($secName -like "*2.WIP*" -or $secName -like "*DIE CUT*") {
                    $leanDcNew = $valNum
                } elseif ($secName -like "*3.WIP*" -or $secName -like "*PREFITTING*") {
                    $prefittingNew = $valNum
                } elseif ($secName -like "*4.WIP*" -or ($secName -like "*MOLDING*" -and $secName -notlike "*LEAN LINE*")) {
                    $moldingNew = $valNum
                } elseif ($secName -like "*5.WIP*" -or $secName -like "*LEAN LINE MOLDED*") {
                    $leanMoldedNew = $valNum
                }
            }
        }
    }
    
    $wbWIP.Close($false)
} finally {
    $excelWIP.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excelWIP) | Out-Null
}

function Get-WipSectionText($name, $actual, $target) {
    $diff = $actual - $target
    $fmtActual = "{0:N0}" -f $actual
    $fmtDiff = "{0:N0}" -f [math]::Abs($diff)
    $fmtTarget = "{0:N0}" -f $target
    if ($diff -gt 0) { return "$($name) (Target $fmtTarget): $fmtActual Pairs (Vượt $fmtDiff Pairs so với Target)`n" }
    elseif ($diff -lt 0) { return "$($name) (Target $fmtTarget): $fmtActual Pairs (Thấp hơn $fmtDiff Pairs so với Target)`n" }
    else { return "$($name) (Target $fmtTarget): $fmtActual Pairs (Đạt đúng Target)`n" }
}

$currentTimeStr = Get-Date -Format "HH:mm dd/MM/yy"

# Báo cáo WIP thường
if ($wipValues.Count -eq 7) {
    $lamination = $wipValues[0] + $wipValues[1]
    $prefitting = $wipValues[2]
    $molding = $wipValues[3]
    $leanMolded = $wipValues[4] + ($wipValues[5] * 0.6) + $wipValues[6]
    $leanDc = $wipValues[5] * 0.4
    $totalActual = $lamination + $prefitting + $molding + $leanMolded + $leanDc

    $wipMsg = "Báo cáo tình hình WIP đến thời điểm ${currentTimeStr}:`n"
    $wipMsg += Get-WipSectionText "1. LAMINATION" $lamination 670000
    $wipMsg += Get-WipSectionText "2. PREFITTING" $prefitting 250000
    $wipMsg += Get-WipSectionText "3. MOLDING" $molding 260000
    $wipMsg += Get-WipSectionText "4. LEANLINE MOLDED" $leanMolded 500000
    $wipMsg += Get-WipSectionText "5. LEANLINE DC" $leanDc 220000
    $totalActualF = "{0:N0}" -f $totalActual
    $wipMsg += "Total WIP (1->5): $totalActualF Pairs`n"
    $targetTotal = 1900000
    if ($totalActual -gt $targetTotal) {
        $diff = "{0:N0}" -f ($totalActual - $targetTotal)
        $wipMsg += "Nhận xét: Tổng WIP (1->5) hiện tại đang VƯỢT target $diff Pairs. Cần chú ý giảm WIP!"
    } elseif ($totalActual -lt $targetTotal) {
        $diff = "{0:N0}" -f ($targetTotal - $totalActual)
        $wipMsg += "Nhận xét: Tổng WIP (1->5) hiện tại đang THẤP HƠN target $diff Pairs. Đang kiểm soát tốt!"
    } else {
        $wipMsg += "Nhận xét: Tổng WIP (1->5) hiện tại ĐẠT ĐÚNG target 1,900,000 Pairs."
    }

    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    Write-Host "=================== BÁO CÁO WIP TỰ ĐỘNG ==================="
    Write-Host $wipMsg
    Write-Host ""
}

# Báo cáo WIP NEW TARGET
$wipNewMsg = "Báo cáo tình hình WIP NEW TARGET đến thời điểm ${currentTimeStr}:`n"
$wipNewMsg += Get-WipSectionText "1. Lamination" $laminationNew 450000
$wipNewMsg += Get-WipSectionText "2. Prefitting" $prefittingNew 200000
$wipNewMsg += Get-WipSectionText "3. Molding" $moldingNew 400000
$wipNewMsg += Get-WipSectionText "4. Leanline DC" $leanDcNew 300000
$wipNewMsg += Get-WipSectionText "5. Leanline Molded" $leanMoldedNew 550000

$totalActualNew = $laminationNew + $prefittingNew + $moldingNew + $leanDcNew + $leanMoldedNew
$totalActualNewF = "{0:N0}" -f $totalActualNew
$wipNewMsg += "Total WIP (1->5): $totalActualNewF Pairs`n"

$targetTotalNew = 1900000
if ($totalActualNew -gt $targetTotalNew) {
    $diffNew = "{0:N0}" -f ($totalActualNew - $targetTotalNew)
    $wipNewMsg += "Nhận xét: Tổng WIP (1->5) hiện tại đang VƯỢT target $diffNew Pairs. Cần chú ý giảm WIP!"
} elseif ($totalActualNew -lt $targetTotalNew) {
    $diffNew = "{0:N0}" -f ($targetTotalNew - $totalActualNew)
    $wipNewMsg += "Nhận xét: Tổng WIP (1->5) hiện tại đang THẤP HƠN target $diffNew Pairs. Đang kiểm soát tốt!"
} else {
    $wipNewMsg += "Nhận xét: Tổng WIP (1->5) hiện tại ĐẠT ĐÚNG target 1,900,000 Pairs."
}

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Write-Host "=================== BÁO CÁO WIP NEW TARGET ==================="
Write-Host $wipNewMsg
