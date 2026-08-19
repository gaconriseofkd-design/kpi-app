Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$win32Src = @"
using System;
using System.Runtime.InteropServices;

public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
}

public class WinHelperClick {
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmd);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
    [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
    [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);
}
"@
Add-Type -TypeDefinition $win32Src -Language CSharp -ErrorAction SilentlyContinue

$imgPath = "c:\Users\prod.public\Ortholite Vietnam\OVN Production - Documents\PRODUCTION\TRUONG OFFICE\PROJECT\KPI APP\APP KPI\scratch\pivot1_export.png"

$p = Get-Process Zalo -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $p) {
    Write-Host "Zalo not running!" -ForegroundColor Red
    exit 1
}

$h = $p.MainWindowHandle
[WinHelperClick]::ShowWindow($h, 9) # Restore
Start-Sleep -Milliseconds 300
[WinHelperClick]::SetForegroundWindow($h)
Start-Sleep -Milliseconds 500

$rect = New-Object RECT
[WinHelperClick]::GetWindowRect($h, [ref]$rect)
Write-Host "Zalo Window Rect: Left=$($rect.Left), Top=$($rect.Top), Right=$($rect.Right), Bottom=$($rect.Bottom)" -ForegroundColor Cyan

# Calculate chat input box position (around 75% across width, 90% down height)
$width = $rect.Right - $rect.Left
$height = $rect.Bottom - $rect.Top

$targetX = [int]($rect.Left + ($width * 0.6))
$targetY = [int]($rect.Top + ($height * 0.88))

Write-Host "Clicking chat input at X=$targetX, Y=$targetY" -ForegroundColor Yellow

# Move mouse and click
[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($targetX, $targetY)
Start-Sleep -Milliseconds 300

$MOUSEEVENTF_LEFTDOWN = 0x0002
$MOUSEEVENTF_LEFTUP = 0x0004
[WinHelperClick]::mouse_event($MOUSEEVENTF_LEFTDOWN, 0, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 50
[WinHelperClick]::mouse_event($MOUSEEVENTF_LEFTUP, 0, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 500

# Copy image to Clipboard
$fileCollection = New-Object System.Collections.Specialized.StringCollection
$fileCollection.Add($imgPath)
[System.Windows.Forms.Clipboard]::SetFileDropList($fileCollection)

$imgObj = [System.Drawing.Image]::FromFile($imgPath)
[System.Windows.Forms.Clipboard]::SetImage($imgObj)
Start-Sleep -Milliseconds 500

# Ctrl+V
$KEYEVENTF_KEYUP = 0x0002
$VK_CONTROL = 0x11
$VK_V = 0x56
$VK_RETURN = 0x0D

Write-Host "Pressing Ctrl+V..." -ForegroundColor Cyan
[WinHelperClick]::keybd_event($VK_CONTROL, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 50
[WinHelperClick]::keybd_event($VK_V, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 50
[WinHelperClick]::keybd_event($VK_V, 0, $KEYEVENTF_KEYUP, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 50
[WinHelperClick]::keybd_event($VK_CONTROL, 0, $KEYEVENTF_KEYUP, [UIntPtr]::Zero)

# Wait for Zalo preview popup
Start-Sleep -Seconds 3

Write-Host "Pressing Enter..." -ForegroundColor Cyan
[WinHelperClick]::keybd_event($VK_RETURN, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 50
[WinHelperClick]::keybd_event($VK_RETURN, 0, $KEYEVENTF_KEYUP, [UIntPtr]::Zero)
Start-Sleep -Seconds 1

$imgObj.Dispose()
Write-Host "Click paste test finished!" -ForegroundColor Green
