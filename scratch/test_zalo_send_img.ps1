Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$win32Src = @"
using System;
using System.Runtime.InteropServices;
public class WinHelperZaloTest {
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

$imgPath = "c:\Users\prod.public\Ortholite Vietnam\OVN Production - Documents\PRODUCTION\TRUONG OFFICE\PROJECT\KPI APP\APP KPI\scratch\pivot1_export.png"

if (-not (Test-Path $imgPath)) {
    Write-Host "File anh khong ton tai!" -ForegroundColor Red
    exit 1
}

$zaloProcess = Get-Process -Name Zalo -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $zaloProcess) {
    Write-Host "Khong tim thay process Zalo!" -ForegroundColor Red
    exit 1
}

$zaloHandle = $zaloProcess.MainWindowHandle

function Focus-Zalo {
    $zaloThread = [WinHelperZaloTest]::GetWindowThreadProcessId($zaloHandle, [ref]0)
    $myThread = [WinHelperZaloTest]::GetCurrentThreadId()
    $fgWindow = [WinHelperZaloTest]::GetForegroundWindow()
    $fgThread = [WinHelperZaloTest]::GetWindowThreadProcessId($fgWindow, [ref]0)
    
    if ($fgThread -ne $zaloThread) {
        [WinHelperZaloTest]::AttachThreadInput($myThread, $zaloThread, $true) | Out-Null
        [WinHelperZaloTest]::AttachThreadInput($fgThread, $zaloThread, $true) | Out-Null
    }
    
    [WinHelperZaloTest]::ShowWindow($zaloHandle, 9) | Out-Null
    Start-Sleep -Milliseconds 300
    [WinHelperZaloTest]::SetForegroundWindow($zaloHandle) | Out-Null
    
    if ($fgThread -ne $zaloThread) {
        [WinHelperZaloTest]::AttachThreadInput($myThread, $zaloThread, $false) | Out-Null
        [WinHelperZaloTest]::AttachThreadInput($fgThread, $zaloThread, $false) | Out-Null
    }
    Start-Sleep -Milliseconds 500
}

function Send-KeyCombine($vkCode) {
    $KEYEVENTF_KEYUP = 0x0002
    $VK_CONTROL = 0x11
    [WinHelperZaloTest]::keybd_event($VK_CONTROL, 0, 0, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 50
    [WinHelperZaloTest]::keybd_event($vkCode, 0, 0, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 50
    [WinHelperZaloTest]::keybd_event($vkCode, 0, $KEYEVENTF_KEYUP, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 50
    [WinHelperZaloTest]::keybd_event($VK_CONTROL, 0, $KEYEVENTF_KEYUP, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 100
}

function Send-Enter {
    $KEYEVENTF_KEYUP = 0x0002
    $VK_RETURN = 0x0D
    [WinHelperZaloTest]::keybd_event($VK_RETURN, 0, 0, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 50
    [WinHelperZaloTest]::keybd_event($VK_RETURN, 0, $KEYEVENTF_KEYUP, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 100
}

Write-Host "Focusing Zalo..." -ForegroundColor Cyan
Focus-Zalo

# 1. Tim nhom Daily Report
Send-KeyCombine 0x46 # Ctrl+F
Start-Sleep -Milliseconds 800
[System.Windows.Forms.Clipboard]::SetText("Daily Report", [System.Windows.Forms.TextDataFormat]::UnicodeText)
Send-KeyCombine 0x56 # Ctrl+V
Start-Sleep -Seconds 2
Send-Enter
Start-Sleep -Seconds 2

# 2. Set Clipboard Image Object (Direct Bitmap + FileDropList for maximum compatibility)
$imgObj = [System.Drawing.Image]::FromFile($imgPath)
[System.Windows.Forms.Clipboard]::SetImage($imgObj)
Start-Sleep -Milliseconds 500

Write-Host "Pasting image into Zalo chat..." -ForegroundColor Cyan
Send-KeyCombine 0x56 # Ctrl+V
# Wait 3 full seconds for Zalo to process image upload preview dialog!
Start-Sleep -Seconds 3

Write-Host "Sending Enter key..." -ForegroundColor Cyan
Send-Enter
Start-Sleep -Seconds 2

$imgObj.Dispose()
Write-Host "DONE TEST SEND IMAGE!" -ForegroundColor Green
