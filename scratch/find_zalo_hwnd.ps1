$win32Src = @"
using System;
using System.Text;
using System.Runtime.InteropServices;

public class ZaloWindowFinder {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);
    [DllImport("user32.dll", CharSet = CharSet.Auto)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder strText, int maxCount);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);

    public static IntPtr FindZaloHwnd() {
        IntPtr foundHwnd = IntPtr.Zero;
        EnumWindows((hWnd, lParam) => {
            if (IsWindowVisible(hWnd)) {
                StringBuilder sb = new StringBuilder(256);
                GetWindowText(hWnd, sb, 256);
                string title = sb.ToString();
                if (title.Contains("Zalo")) {
                    Console.WriteLine("Found visible Zalo window: HWND = " + hWnd + ", Title = '" + title + "'");
                    foundHwnd = hWnd;
                    return false; // Stop enumeration
                }
            }
            return true;
        }, IntPtr.Zero);
        return foundHwnd;
    }
}
"@
Add-Type -TypeDefinition $win32Src -Language CSharp -ErrorAction SilentlyContinue

$hwnd = [ZaloWindowFinder]::FindZaloHwnd()
if ($hwnd -ne [IntPtr]::Zero) {
    Write-Host "SUCCESS! Found Zalo HWND: $hwnd" -ForegroundColor Green
} else {
    Write-Host "Failed to find Zalo HWND via EnumWindows!" -ForegroundColor Red
}
