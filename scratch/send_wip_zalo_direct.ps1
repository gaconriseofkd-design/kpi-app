Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$win32Src = @"
using System;
using System.Runtime.InteropServices;
public class WinHelperDirect {
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmd);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
    [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
}
"@
Add-Type -TypeDefinition $win32Src -Language CSharp -ErrorAction SilentlyContinue

$zaloProcess = Get-Process -Name Zalo -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $zaloProcess) {
    Write-Host "Khong tim thay Zalo!" -ForegroundColor Red
    exit 1
}

$zaloHandle = $zaloProcess.MainWindowHandle

function Focus-ZaloDirect {
    $zaloThread = [WinHelperDirect]::GetWindowThreadProcessId($zaloHandle, [ref]0)
    $myThread = [WinHelperDirect]::GetCurrentThreadId()
    $fgWindow = [WinHelperDirect]::GetForegroundWindow()
    $fgThread = [WinHelperDirect]::GetWindowThreadProcessId($fgWindow, [ref]0)
    
    if ($fgThread -ne $zaloThread) {
        [WinHelperDirect]::AttachThreadInput($myThread, $zaloThread, $true) | Out-Null
        [WinHelperDirect]::AttachThreadInput($fgThread, $zaloThread, $true) | Out-Null
    }
    
    [WinHelperDirect]::ShowWindow($zaloHandle, 9) | Out-Null # SW_RESTORE
    Start-Sleep -Milliseconds 300
    [WinHelperDirect]::SetForegroundWindow($zaloHandle) | Out-Null
    
    if ($fgThread -ne $zaloThread) {
        [WinHelperDirect]::AttachThreadInput($myThread, $zaloThread, $false) | Out-Null
        [WinHelperDirect]::AttachThreadInput($fgThread, $zaloThread, $false) | Out-Null
    }
    Start-Sleep -Milliseconds 500
}

# Key event helpers using keybd_event (bypasses SendKeys permission restriction)
function Send-CtrlKey($vkCode) {
    $KEYEVENTF_KEYUP = 0x0002
    $VK_CONTROL = 0x11
    [WinHelperDirect]::keybd_event($VK_CONTROL, 0, 0, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 50
    [WinHelperDirect]::keybd_event($vkCode, 0, 0, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 50
    [WinHelperDirect]::keybd_event($vkCode, 0, $KEYEVENTF_KEYUP, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 50
    [WinHelperDirect]::keybd_event($VK_CONTROL, 0, $KEYEVENTF_KEYUP, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 100
}

function Send-EnterKey {
    $KEYEVENTF_KEYUP = 0x0002
    $VK_RETURN = 0x0D
    [WinHelperDirect]::keybd_event($VK_RETURN, 0, 0, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 50
    [WinHelperDirect]::keybd_event($VK_RETURN, 0, $KEYEVENTF_KEYUP, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 100
}

$parent = Get-ChildItem "C:\Users\prod.public\Ortholite Vietnam\OVN Production - Documents\PRODUCTION\" -Filter "Nh*n Lg" | Select-Object -First 1
$WIP_EXCEL_PATH = Join-Path $parent.FullName "Schedule\Ovn Pro Schedule.xlsb"

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

Write-Host "Focusing Zalo and searching Daily Report..." -ForegroundColor Cyan
Focus-ZaloDirect

# Ctrl+F to search
Send-CtrlKey 0x46 # 0x46 is VK_F
Start-Sleep -Milliseconds 800

# Clipboard set search query "Daily Report"
[System.Windows.Forms.Clipboard]::SetText("Daily Report", [System.Windows.Forms.TextDataFormat]::UnicodeText)
Send-CtrlKey 0x56 # 0x56 is VK_V
Start-Sleep -Seconds 2

# Enter to open group
Send-EnterKey
Start-Sleep -Seconds 2

# Clipboard set message text
[System.Windows.Forms.Clipboard]::SetText($wipNewMsg, [System.Windows.Forms.TextDataFormat]::UnicodeText)
Send-CtrlKey 0x56 # 0x56 is VK_V
Start-Sleep -Milliseconds 600

# Enter to send
Send-EnterKey
Start-Sleep -Seconds 1

Write-Host "DA GUI BAO CAO ZALO thanh cong qua keybd_event!" -ForegroundColor Green
