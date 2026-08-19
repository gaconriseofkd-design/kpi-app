$parent = Get-ChildItem "C:\Users\prod.public\Ortholite Vietnam\OVN Production - Documents\PRODUCTION\" -Filter "Nh*n Lg" | Select-Object -First 1
$WIP_EXCEL_PATH = Join-Path $parent.FullName "Schedule\Ovn Pro Schedule.xlsb"

if (-not (Test-Path $WIP_EXCEL_PATH)) {
    Write-Host "Khong tim thay file Excel: $WIP_EXCEL_PATH" -ForegroundColor Red
    exit 1
}

$excelWIP = New-Object -ComObject Excel.Application
$excelWIP.Visible = $false
$excelWIP.DisplayAlerts = $false

$laminationActual = 0
$leanDcActual = 0
$prefittingActual = 0
$moldingActual = 0
$leanMoldedActual = 0

try {
    $wbWIP = $excelWIP.Workbooks.Open($WIP_EXCEL_PATH, 0, $true)
    $shRec = $null
    try { $shRec = $wbWIP.Sheets.Item("RECORD WIP") } catch {}
    if (-not $shRec) {
        try { $shRec = $wbWIP.Sheets.Item("Record Wip") } catch {}
    }
    
    if ($shRec) {
        # Đọc theo format mới (Row 1/Row 4 = Headers/Notes, Row 2 = Values across columns)
        for ($c = 1; $c -le 10; $c++) {
            $secName = ($shRec.Cells.Item(1, $c).Text + " " + $shRec.Cells.Item(4, $c).Text).Trim()
            $valText = $shRec.Cells.Item(2, $c).Text
            $valNum = 0
            if (-not [string]::IsNullOrWhiteSpace($valText)) {
                $valText = $valText -replace '[^\d\.-]', ''
                if ($valText) { [double]::TryParse($valText, [ref]$valNum) | Out-Null }
            }
            Write-Host "Col ${c}: secName='$secName' | valText='$valText' | valNum=$valNum"
            
            if ($secName -like "*1.MATERIAL*" -or $secName -like "*LAMINATION*") {
                $laminationActual = $valNum
                Write-Host "  -> Matched Lamination"
            } elseif ($secName -like "*2.WIP*" -or $secName -like "*DIE CUT*" -or $secName -like "*Leanline DC*") {
                $leanDcActual = $valNum
                Write-Host "  -> Matched Leanline DC"
            } elseif ($secName -like "*3.WIP*" -or $secName -like "*PREFITTING*" -or $secName -like "*Prefitting*") {
                $prefittingActual = $valNum
                Write-Host "  -> Matched Prefitting"
            } elseif ($secName -like "*4.WIP*" -or ($secName -like "*MOLDING*" -and $secName -notlike "*LEAN*")) {
                $moldingActual = $valNum
                Write-Host "  -> Matched Molding"
            } elseif ($secName -like "*5.WIP*" -or $secName -like "*LEAN LINE MOLDED*" -or $secName -like "*Leanline Molded*") {
                $leanMoldedActual = $valNum
                Write-Host "  -> Matched Leanline Molded"
            }
        }
        
        # Fallback format cũ
        if ($laminationActual -eq 0 -and $leanDcActual -eq 0 -and $prefittingActual -eq 0 -and $moldingActual -eq 0 -and $leanMoldedActual -eq 0) {
            for ($r = 2; $r -le 10; $r++) {
                $secName = $shRec.Cells.Item($r, 1).Text
                $valText = $shRec.Cells.Item($r, 2).Text
                $valNum = 0
                if (-not [string]::IsNullOrWhiteSpace($valText)) {
                    $valText = $valText -replace '[^\d\.-]', ''
                    if ($valText) { [double]::TryParse($valText, [ref]$valNum) | Out-Null }
                }
                
                if ($secName -like "*1.MATERIAL*" -or $secName -like "*LAMINATION*") {
                    $laminationActual = $valNum
                } elseif ($secName -like "*2.WIP*" -or $secName -like "*DIE CUT*") {
                    $leanDcActual = $valNum
                } elseif ($secName -like "*3.WIP*" -or $secName -like "*PREFITTING*") {
                    $prefittingActual = $valNum
                } elseif ($secName -like "*4.WIP*" -or ($secName -like "*MOLDING*" -and $secName -notlike "*LEAN LINE*")) {
                    $moldingActual = $valNum
                } elseif ($secName -like "*5.WIP*" -or $secName -like "*LEAN LINE MOLDED*") {
                    $leanMoldedActual = $valNum
                }
            }
        }
    }
    $wbWIP.Close($false)
} finally {
    $excelWIP.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excelWIP) | Out-Null
}

function Format-SecText($name, $actual, $target) {
    $diff = $actual - $target
    $fmtActual = "{0:N0}" -f $actual
    $fmtDiff = "{0:N0}" -f [math]::Abs($diff)
    $fmtTarget = "{0:N0}" -f $target
    if ($diff -gt 0) { return "$($name) (Target $fmtTarget): $fmtActual Pairs (Vuot $fmtDiff Pairs so voi Target)`n" }
    elseif ($diff -lt 0) { return "$($name) (Target $fmtTarget): $fmtActual Pairs (Thap hon $fmtDiff Pairs so voi Target)`n" }
    else { return "$($name) (Target $fmtTarget): $fmtActual Pairs (Dat dung Target)`n" }
}

$currentTimeStr = Get-Date -Format "HH:mm dd/MM/yy"
$wipNewMsg = "Báo cáo tình hình WIP NEW TARGET đến thời điểm ${currentTimeStr}:`n"
$wipNewMsg += Format-SecText "1. Lamination" $laminationActual 450000
$wipNewMsg += Format-SecText "2. Prefitting" $prefittingActual 200000
$wipNewMsg += Format-SecText "3. Molding" $moldingActual 400000
$wipNewMsg += Format-SecText "4. Leanline DC" $leanDcActual 300000
$wipNewMsg += Format-SecText "5. Leanline Molded" $leanMoldedActual 550000

$totalActualNew = $laminationActual + $prefittingActual + $moldingActual + $leanDcActual + $leanMoldedActual
$totalActualNewF = "{0:N0}" -f $totalActualNew
$wipNewMsg += "Total WIP (1->5): $totalActualNewF Pairs`n"

$targetTotalNew = 1900000
if ($totalActualNew -gt $targetTotalNew) {
    $diffNewF = "{0:N0}" -f ($totalActualNew - $targetTotalNew)
    $wipNewMsg += "Nhận xét: Tổng WIP (1->5) hiện tại đang VƯỢT target $diffNewF Pairs. Cần chú ý giảm WIP!"
} elseif ($totalActualNew -lt $targetTotalNew) {
    $diffNewF = "{0:N0}" -f ($targetTotalNew - $totalActualNew)
    $wipNewMsg += "Nhận xét: Tổng WIP (1->5) hiện tại đang THẤP HƠN target $diffNewF Pairs. Đang kiểm soát tốt!"
} else {
    $wipNewMsg += "Nhận xét: Tổng WIP (1->5) hiện tại ĐẠT ĐÚNG target 1,900,000 Pairs."
}

Write-Host "=== DASHBOARD WIP NEW TARGET OUTPUT ===" -ForegroundColor Cyan
Write-Host "Lamination: $laminationActual"
Write-Host "Leanline DC: $leanDcActual"
Write-Host "Prefitting: $prefittingActual"
Write-Host "Molding: $moldingActual"
Write-Host "Leanline Molded: $leanMoldedActual"
Write-Host "Total Actual: $totalActualNew"
Write-Host ""
Write-Host "=== MESSAGE GENERATED ===" -ForegroundColor Green
Write-Host $wipNewMsg
