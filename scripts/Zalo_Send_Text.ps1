param(
    [string]$GroupName = "Daily Report",
    [string]$Message = ""
)

Add-Type -AssemblyName System.Windows.Forms
$win32Src = @"
using System;
using System.Runtime.InteropServices;
public class WinHelperZaloText {
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmd);
    [DllImport("user32.dll")] public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
}
"@
Add-Type -TypeDefinition $win32Src -Language CSharp -ErrorAction SilentlyContinue

function Focus-Zalo {
    $hWnd = [WinHelperZaloText]::FindWindow("Zalo", $null)
    if ($hWnd -ne [IntPtr]::Zero) {
        [WinHelperZaloText]::ShowWindow($hWnd, 9)
        [WinHelperZaloText]::SetForegroundWindow($hWnd)
    }
}

if (-not $Message) { exit 1 }

Focus-Zalo
Start-Sleep -Seconds 1

[System.Windows.Forms.SendKeys]::SendWait("^f")
Start-Sleep -Milliseconds 800
[System.Windows.Forms.Clipboard]::SetText($GroupName, [System.Windows.Forms.TextDataFormat]::UnicodeText)
[System.Windows.Forms.SendKeys]::SendWait("^v")
Start-Sleep -Seconds 2
[System.Windows.Forms.SendKeys]::SendWait("{DOWN}")
Start-Sleep -Milliseconds 500
[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
Start-Sleep -Seconds 2

[System.Windows.Forms.Clipboard]::SetText($Message, [System.Windows.Forms.TextDataFormat]::UnicodeText)
Start-Sleep -Milliseconds 500
[System.Windows.Forms.SendKeys]::SendWait("^v")
Start-Sleep -Milliseconds 500
[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
Start-Sleep -Seconds 2
