# scripts/Zalo_Send_Image.ps1
# Script nay PHAI chay trong cua so co the nhin thay (WindowStyle Normal)
# Duong dan anh OT co dinh - khong truyen param de tranh loi path-with-spaces

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$ImagePath = "c:\Users\prod.public\Ortholite Vietnam\OVN Production - Documents\PRODUCTION\TRUONG OFFICE\PROJECT\KPI APP\APP KPI\scratch\ot_pivot_report.png"

function Write-Log([string]$msg) {
    $t = Get-Date -Format "HH:mm:ss"
    Write-Host "[$t] $msg"
}

Write-Log "=== ZALO SEND IMAGE START ==="
Write-Log "Tim file anh tai: $ImagePath"

if (-not (Test-Path $ImagePath)) {
    Write-Log "KHONG TIM THAY FILE ANH: $ImagePath"
    Start-Sleep -Seconds 5
    exit 1
}

Write-Log "Da tim thay file anh OK!"
Write-Log "Chuan bi gui vao nhom Zalo Daily Report..."

# === Khởi tạo thư viện Win32 API ===
$win32Src = @"
using System;
using System.Runtime.InteropServices;
public class WinHelperZalo {
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmd);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
}
"@
Add-Type -TypeDefinition $win32Src -Language CSharp -ErrorAction SilentlyContinue

$script:myHandle = (Get-Process -Id $PID).MainWindowHandle

Write-Log "Dang kiem tra Zalo PC..."
$zaloProcess = Get-Process -Name Zalo -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle } | Select-Object -First 1
if (-not $zaloProcess) {
    Write-Log "LOI: Zalo PC chua mo."
    Start-Sleep -Seconds 5
    exit 1
}
Write-Log "Zalo dang mo: PID=$($zaloProcess.Id) | Title='$($zaloProcess.MainWindowTitle)'"
$script:zaloHandle = $zaloProcess.MainWindowHandle

function Focus-Zalo {
    if ($script:myHandle -ne [IntPtr]::Zero) {
        [WinHelperZalo]::ShowWindow($script:myHandle, 6) | Out-Null   # Minimize terminal
    }
    
    $zaloThread = [WinHelperZalo]::GetWindowThreadProcessId($script:zaloHandle, [ref]0)
    $myThread = [WinHelperZalo]::GetCurrentThreadId()
    $fgWindow = [WinHelperZalo]::GetForegroundWindow()
    $fgThread = [WinHelperZalo]::GetWindowThreadProcessId($fgWindow, [ref]0)
    
    if ($fgThread -ne $zaloThread) {
        [WinHelperZalo]::AttachThreadInput($myThread, $zaloThread, $true) | Out-Null
        [WinHelperZalo]::AttachThreadInput($fgThread, $zaloThread, $true) | Out-Null
    }
    
    [WinHelperZalo]::ShowWindow($script:zaloHandle, 9) | Out-Null   # Restore
    Start-Sleep -Milliseconds 300
    [WinHelperZalo]::SetForegroundWindow($script:zaloHandle) | Out-Null
    
    if ($fgThread -ne $zaloThread) {
        [WinHelperZalo]::AttachThreadInput($myThread, $zaloThread, $false) | Out-Null
        [WinHelperZalo]::AttachThreadInput($fgThread, $zaloThread, $false) | Out-Null
    }
    Start-Sleep -Milliseconds 500
}

Write-Log "Minimize terminal, focus Zalo..."
Focus-Zalo
Start-Sleep -Seconds 1

# Tim nhom Daily Report bang Ctrl+F
Write-Log "Tim nhom Daily Report..."
[System.Windows.Forms.SendKeys]::SendWait("^f")
Start-Sleep -Milliseconds 800
[System.Windows.Forms.Clipboard]::SetText("Daily Report", [System.Windows.Forms.TextDataFormat]::UnicodeText)
[System.Windows.Forms.SendKeys]::SendWait("^v")
Start-Sleep -Seconds 2
[System.Windows.Forms.SendKeys]::SendWait("{DOWN}")
Start-Sleep -Milliseconds 500
[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
Start-Sleep -Seconds 2

# Gui dong text truoc
Write-Log "Gui dong text tieu de..."
$msgText = "Báo cáo OT% các section:"
[System.Windows.Forms.Clipboard]::SetText($msgText, [System.Windows.Forms.TextDataFormat]::UnicodeText)
Start-Sleep -Milliseconds 500
Focus-Zalo
[System.Windows.Forms.SendKeys]::SendWait("^v")
Start-Sleep -Milliseconds 500
[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
Start-Sleep -Seconds 1

# Dat anh vao clipboard va dan vao Zalo
Write-Log "Dan anh vao Zalo..."
try {
    $imgObj = [System.Drawing.Image]::FromFile($ImagePath)
    [System.Windows.Forms.Clipboard]::SetImage($imgObj)
    $imgObj.Dispose()
    Write-Log "Da dat anh vao clipboard OK"
} catch {
    Write-Log "Loi dat anh vao clipboard: $_"
    Start-Sleep -Seconds 5
    exit 1
}

Start-Sleep -Milliseconds 500
Focus-Zalo
[System.Windows.Forms.SendKeys]::SendWait("^v")
Write-Log "Da nhan Ctrl+V - cho Zalo hien modal xem truoc anh (4 giay)..."
Start-Sleep -Seconds 4

[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
Write-Log "Da nhan Enter de gui anh!"
Start-Sleep -Seconds 2

Write-Log "=== HOAN THANH! Da gui anh OT vao nhom Daily Report. ==="
Start-Sleep -Seconds 3
exit 0
