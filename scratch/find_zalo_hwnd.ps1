Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class WindowEnumerator {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")] public static extern int GetClassName(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
}
"@

$list = New-Object System.Collections.Generic.List[PSCustomObject]

[WindowEnumerator]::EnumWindows({
    param($hWnd, $lParam)
    $sbTitle = New-Object System.Text.StringBuilder 512
    [WindowEnumerator]::GetWindowText($hWnd, $sbTitle, 512) | Out-Null
    $title = $sbTitle.ToString()
    
    $sbClass = New-Object System.Text.StringBuilder 512
    [WindowEnumerator]::GetClassName($hWnd, $sbClass, 512) | Out-Null
    $className = $sbClass.ToString()
    
    $isVisible = [WindowEnumerator]::IsWindowVisible($hWnd)
    $pid = 0
    [WindowEnumerator]::GetWindowThreadProcessId($hWnd, [ref]$pid) | Out-Null
    
    $procName = ""
    try { $procName = (Get-Process -Id $pid -ErrorAction SilentlyContinue).ProcessName } catch {}

    if ($procName -match "Zalo" -or $title -match "Zalo") {
        $list.Add([PSCustomObject]@{
            Handle = $hWnd
            PID = $pid
            Process = $procName
            Visible = $isVisible
            Class = $className
            Title = $title
        })
    }
    return $true
}, [IntPtr]::Zero) | Out-Null

$list | Format-Table -AutoSize
