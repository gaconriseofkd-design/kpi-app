Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$win32Src = @"
using System;
using System.Runtime.InteropServices;
public class WinHelperSendNow {
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmd);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
}
"@
Add-Type -TypeDefinition $win32Src -Language CSharp -ErrorAction SilentlyContinue

$zaloProcess = Get-Process -Name Zalo -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $zaloProcess) {
    Write-Host "Khong tim thay Zalo!" -ForegroundColor Red
    exit 1
}

$zaloHandle = $zaloProcess.MainWindowHandle

function Focus-ZaloNow {
    $zaloThread = [WinHelperSendNow]::GetWindowThreadProcessId($zaloHandle, [ref]0)
    $myThread = [WinHelperSendNow]::GetCurrentThreadId()
    $fgWindow = [WinHelperSendNow]::GetForegroundWindow()
    $fgThread = [WinHelperSendNow]::GetWindowThreadProcessId($fgWindow, [ref]0)
    
    if ($fgThread -ne $zaloThread) {
        [WinHelperSendNow]::AttachThreadInput($myThread, $zaloThread, $true) | Out-Null
        [WinHelperSendNow]::AttachThreadInput($fgThread, $zaloThread, $true) | Out-Null
    }
    
    [WinHelperSendNow]::ShowWindow($zaloHandle, 9) | Out-Null
    Start-Sleep -Milliseconds 300
    [WinHelperSendNow]::SetForegroundWindow($zaloHandle) | Out-Null
    
    if ($fgThread -ne $zaloThread) {
        [WinHelperSendNow]::AttachThreadInput($myThread, $zaloThread, $false) | Out-Null
        [WinHelperSendNow]::AttachThreadInput($fgThread, $zaloThread, $false) | Out-Null
    }
    Start-Sleep -Milliseconds 500
}

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
        # Format mới (ngang: Row 1 Header, Row 4 Ghi chú, Row 2 Giá trị các cột)
        for ($c = 1; $c -le 10; $c++) {
            $secName = ($shRec.Cells.Item(1, $c).Text + " " + $shRec.Cells.Item(4, $c).Text).Trim()
            $valText = $shRec.Cells.Item(2, $c).Text
            $valNum = 0
            if (-not [string]::IsNullOrWhiteSpace($valText)) {
                $valText = $valText -replace '[^\d\.-]', ''
                if ($valText) { [double]::TryParse($valText, [ref]$valNum) | Out-Null }
            }
            
            if ($secName -like "*1.MATERIAL*" -or $secName -like "*LAMINATION*") {
                $laminationActual = $valNum
            } elseif ($secName -like "*2.WIP*" -or $secName -like "*DIE CUT*" -or $secName -like "*Leanline DC*") {
                $leanDcActual = $valNum
            } elseif ($secName -like "*3.WIP*" -or $secName -like "*PREFITTING*" -or $secName -like "*Prefitting*") {
                $prefittingActual = $valNum
            } elseif ($secName -like "*4.WIP*" -or ($secName -like "*MOLDING*" -and $secName -notlike "*LEAN*")) {
                $moldingActual = $valNum
            } elseif ($secName -like "*5.WIP*" -or $secName -like "*LEAN LINE MOLDED*" -or $secName -like "*Leanline Molded*") {
                $leanMoldedActual = $valNum
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
    if ($diff -gt 0) { return "$($name) (Target $fmtTarget): $fmtActual Pairs (Vượt $fmtDiff Pairs so với Target)`n" }
    elseif ($diff -lt 0) { return "$($name) (Target $fmtTarget): $fmtActual Pairs (Thấp hơn $fmtDiff Pairs so với Target)`n" }
    else { return "$($name) (Target $fmtTarget): $fmtActual Pairs (Đạt đúng Target)`n" }
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

Write-Host "Gui bao cao sau:" -ForegroundColor Cyan
Write-Host $wipNewMsg -ForegroundColor Green

Focus-ZaloNow

$wshell = New-Object -ComObject WScript.Shell
$wshell.AppActivate($zaloProcess.Id)
Start-Sleep -Seconds 1

$wshell.SendKeys("^f")
Start-Sleep -Milliseconds 800
[System.Windows.Forms.Clipboard]::SetText("Daily Report", [System.Windows.Forms.TextDataFormat]::UnicodeText)
$wshell.SendKeys("^v")
Start-Sleep -Seconds 2
$wshell.SendKeys("~")
Start-Sleep -Seconds 2

[System.Windows.Forms.Clipboard]::SetText($wipNewMsg, [System.Windows.Forms.TextDataFormat]::UnicodeText)
$wshell.SendKeys("^v")
Start-Sleep -Milliseconds 600
$wshell.SendKeys("~")
Start-Sleep -Seconds 1

Write-Host "DA GUI BAO CAO THANH CONG!" -ForegroundColor Green
