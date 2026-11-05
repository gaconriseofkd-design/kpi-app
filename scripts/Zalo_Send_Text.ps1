param(
    [string]$GroupName = "Daily Report",
    [string]$Message = ""
)

if (-not $Message) { 
    Write-Host "[Zalo_Send_Text] Loi: Noi dung tin nhan trong (Message is empty)." -ForegroundColor Red
    exit 1 
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$win32Src = @"
using System;
using System.Text;
using System.Diagnostics;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Threading;

public class WinHelperZaloText {
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmd);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")] public static extern int GetClassName(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
    [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hWnd);

    [DllImport("user32.dll", SetLastError = true)] public static extern IntPtr OpenWindowStation(string a, bool b, uint c);
    [DllImport("user32.dll", SetLastError = true)] public static extern bool SetProcessWindowStation(IntPtr a);
    [DllImport("user32.dll", SetLastError = true)] public static extern IntPtr OpenDesktop(string lpszDesktop, uint dwFlags, bool fInherit, uint dwDesiredAccess);
    [DllImport("user32.dll", SetLastError = true)] public static extern bool SetThreadDesktop(IntPtr hDesktop);
    [DllImport("user32.dll", SetLastError = true)] public static extern bool CloseDesktop(IntPtr hDesktop);
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool EnumDesktopWindows(IntPtr hDesktop, EnumWindowsProc enumProc, IntPtr lParam);

    private static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
    private static readonly IntPtr HWND_NOTOPMOST = new IntPtr(-2);
    private const uint SWP_NOMOVE = 0x0002;
    private const uint SWP_NOSIZE = 0x0001;
    private const uint SWP_SHOWWINDOW = 0x0040;

    public static IntPtr FindVisibleZalo(out uint zaloPid) {
        uint targetPid = 0;
        IntPtr targetHwnd = IntPtr.Zero;

        Process[] procs = Process.GetProcessesByName("Zalo");
        HashSet<uint> pids = new HashSet<uint>();
        foreach (Process p in procs) { pids.Add((uint)p.Id); }

        IntPtr hWinsta = OpenWindowStation("winsta0", false, 0x037F);
        if (hWinsta != IntPtr.Zero) SetProcessWindowStation(hWinsta);
        IntPtr hDesk = OpenDesktop("default", 0, false, 0x01FF);
        if (hDesk != IntPtr.Zero) {
            SetThreadDesktop(hDesk);
            EnumDesktopWindows(hDesk, (hWnd, lParam) => {
                if (IsWindowVisible(hWnd)) {
                    uint pid;
                    GetWindowThreadProcessId(hWnd, out pid);
                    if (pids.Contains(pid)) {
                        StringBuilder sbClass = new StringBuilder(256);
                        GetClassName(hWnd, sbClass, 256);
                        string cls = sbClass.ToString();

                        if (cls == "Chrome_WidgetWin_1") {
                            RECT r;
                            GetWindowRect(hWnd, out r);
                            int w = r.Right - r.Left;
                            int h = r.Bottom - r.Top;
                            bool iconic = IsIconic(hWnd);

                            // Chon dung cua so chinh (khong phai toast notification 352x82)
                            if (iconic || (w >= 400 && h >= 400)) {
                                targetHwnd = hWnd;
                                targetPid = pid;
                                return false;
                            }
                        }
                    }
                }
                return true;
            }, IntPtr.Zero);
            CloseDesktop(hDesk);
        }

        zaloPid = targetPid;
        return targetHwnd;
    }

    public static bool FocusZalo(out uint activePid) {
        bool success = false;
        uint outPid = 0;
        Thread t = new Thread(() => {
            IntPtr hDesk = OpenDesktop("default", 0, false, 0x01FF);
            if (hDesk != IntPtr.Zero) SetThreadDesktop(hDesk);

            uint targetPid;
            IntPtr hWnd = FindVisibleZalo(out targetPid);
            if (hWnd == IntPtr.Zero) {
                if (hDesk != IntPtr.Zero) CloseDesktop(hDesk);
                return;
            }

            uint zaloThread = GetWindowThreadProcessId(hWnd, out targetPid);
            uint currentThread = GetCurrentThreadId();
            IntPtr fgHwnd = GetForegroundWindow();
            uint dummy;
            uint fgThread = GetWindowThreadProcessId(fgHwnd, out dummy);

            if (fgThread != zaloThread) {
                AttachThreadInput(currentThread, zaloThread, true);
                AttachThreadInput(fgThread, zaloThread, true);
            }

            ShowWindow(hWnd, 9); // SW_RESTORE
            ShowWindow(hWnd, 5); // SW_SHOW
            SetWindowPos(hWnd, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);
            SetWindowPos(hWnd, HWND_NOTOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);
            BringWindowToTop(hWnd);
            SetForegroundWindow(hWnd);

            if (fgThread != zaloThread) {
                AttachThreadInput(currentThread, zaloThread, false);
                AttachThreadInput(fgThread, zaloThread, false);
            }

            Thread.Sleep(500);

            IntPtr newFg = GetForegroundWindow();
            uint newFgPid;
            GetWindowThreadProcessId(newFg, out newFgPid);
            outPid = newFgPid;
            success = (newFgPid == targetPid);

            if (hDesk != IntPtr.Zero) CloseDesktop(hDesk);
        });
        t.Start();
        t.Join();
        activePid = outPid;
        return success;
    }
}
"@
Add-Type -TypeDefinition $win32Src -Language CSharp -ErrorAction SilentlyContinue

# === Co che khoa tranh xung dot giua cac tien trinh Zalo ===
$lockFile = Join-Path $env:TEMP "zalo_automation_active.lock"
$lockStream = $null
$lockAcquired = $false
$startLockWait = Get-Date

while ((Get-Date) - $startLockWait -lt [TimeSpan]::FromSeconds(60)) {
    try {
        $lockStream = [System.IO.File]::Open($lockFile, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
        $lockAcquired = $true
        break
    } catch {
        try {
            if (Test-Path $lockFile) {
                $fi = Get-Item $lockFile
                if ((Get-Date) - $fi.LastWriteTime -gt [TimeSpan]::FromMinutes(5)) {
                    Remove-Item $lockFile -Force -ErrorAction SilentlyContinue
                }
            }
        } catch {}
        Start-Sleep -Seconds 1
    }
}

try {
    $allZaloPids = @((Get-Process -Name Zalo -ErrorAction SilentlyContinue).Id)
    if ($allZaloPids.Count -eq 0) {
        Write-Host "[Zalo_Send_Text] LOI: Khong tim thay ung dung Zalo dang chay!" -ForegroundColor Red
        exit 1
    }

    $activePid = 0
    $focusOk = [WinHelperZaloText]::FocusZalo([ref]$activePid)
    if (-not $focusOk -or -not ($allZaloPids -contains $activePid)) {
        $wshell = New-Object -ComObject WScript.Shell
        $wshell.AppActivate("Zalo") | Out-Null
        Start-Sleep -Milliseconds 800
        $focusOk = [WinHelperZaloText]::FocusZalo([ref]$activePid)
    }

    # KIEM TRA AN TOAN TUYET DOI: Cua so dang focus PHAI LA ZALO, neu khong phai thi DUNG NGAY!
    if (-not ($allZaloPids -contains $activePid)) {
        Write-Host "[Zalo_Send_Text] CANH BAO AN TOAN: Khong the Focus cua so Zalo (PID hien tai la $activePid). Tu choi gui phim de tranh go nham!" -ForegroundColor Red
        exit 1
    }

    Start-Sleep -Milliseconds 400

    # 1. Dong popup / search cu
    [System.Windows.Forms.SendKeys]::SendWait("{ESC}")
    Start-Sleep -Milliseconds 400

    # 2. Mo tim kiem
    [System.Windows.Forms.SendKeys]::SendWait("^f")
    Start-Sleep -Milliseconds 800

    # 3. Dan ten nhom
    $clipOk = $false
    for ($c = 0; $c -lt 5; $c++) {
        try {
            [System.Windows.Forms.Clipboard]::SetText($GroupName, [System.Windows.Forms.TextDataFormat]::UnicodeText)
            $clipOk = $true
            break
        } catch { Start-Sleep -Milliseconds 200 }
    }
    if (-not $clipOk) {
        Write-Host "[Zalo_Send_Text] Loi: Khong the copy ten nhom vao Clipboard!" -ForegroundColor Red
        exit 1
    }

    [System.Windows.Forms.SendKeys]::SendWait("^v")
    Start-Sleep -Seconds 2

    # 4. Chon ket qua dau tien va Enter de vao dung nhom
    [System.Windows.Forms.SendKeys]::SendWait("{DOWN}")
    Start-Sleep -Milliseconds 600
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Start-Sleep -Seconds 2

    # 5. Dan noi dung tin nhan vao o chat
    $msgOk = $false
    for ($c = 0; $c -lt 5; $c++) {
        try {
            [System.Windows.Forms.Clipboard]::SetText($Message, [System.Windows.Forms.TextDataFormat]::UnicodeText)
            $msgOk = $true
            break
        } catch { Start-Sleep -Milliseconds 200 }
    }
    if (-not $msgOk) {
        Write-Host "[Zalo_Send_Text] Loi: Khong the copy noi dung tin nhan vao Clipboard!" -ForegroundColor Red
        exit 1
    }

    Start-Sleep -Milliseconds 400
    [System.Windows.Forms.SendKeys]::SendWait("^v")
    Start-Sleep -Milliseconds 1200

    # 6. Nhan Enter de gui tin nhan
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Start-Sleep -Seconds 2

    Write-Host "[Zalo_Send_Text] Da gui thanh cong tin nhan vao nhom '$GroupName'." -ForegroundColor Green
} finally {
    if ($lockStream) {
        try {
            $lockStream.Close()
            $lockStream.Dispose()
        } catch {}
    }
    if (Test-Path $lockFile) {
        Remove-Item $lockFile -Force -ErrorAction SilentlyContinue
    }
}
