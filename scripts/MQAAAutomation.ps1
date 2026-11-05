# scripts/MQAAAutomation.ps1
# Script tự động gửi báo cáo MQAA vào Zalo mỗi sáng 08:00
# Logic: Báo cáo hàng ngày cho ngày hôm trước + Tổng kết tuần vào Thứ 7

param(
    [switch]$ManualTrigger,
    [string]$TargetReport = "",
    [string]$TargetDate = ""
)

# === Cấu hình (Người dùng thay đổi tại đây) ===
$SUPABASE_URL = "https://ewhfhputqeyebffjwtnl.supabase.co"
$SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3aGZocHV0cWV5ZWJmZmp3dG5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyOTU1OTMsImV4cCI6MjEwNDg3MTU5M30.a368bZeQDr2du8R4ipKHpMZm0ITJlIqeD6wqba-fbRM"
$ZALO_GROUP_NAME  = "MQAA TESTING REPORT"
$DEFAULT_REPORT_TIME = "08:00"

# === Log file ===
$LOG_FILE = Join-Path $PSScriptRoot "mqaa_automation.log"
function Write-Log {
    param([string]$msg, [string]$level = "INFO")
    $ts   = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$ts] [$level] $msg"
    Add-Content -Path $LOG_FILE -Value $line -Encoding UTF8
    if     ($level -eq "ERROR") { Write-Host $line -ForegroundColor Red }
    elseif ($level -eq "WARN")  { Write-Host $line -ForegroundColor Yellow }
    else                         { Write-Host $line }
}

# === Khởi tạo thư viện ===
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# === Win32 API: OpenDesktop + EnumWindows + SetForegroundWindow cho Zalo ===
$win32Src = @"
using System;
using System.Text;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;

public class WinHelperMQAA {
    [DllImport("user32.dll", SetLastError = true)] public static extern IntPtr OpenWindowStation(string a, bool b, uint c);
    [DllImport("user32.dll", SetLastError = true)] public static extern bool SetProcessWindowStation(IntPtr a);
    [DllImport("user32.dll", SetLastError = true)] public static extern IntPtr OpenDesktop(string lpszDesktop, uint dwFlags, bool fInherit, uint dwDesiredAccess);
    [DllImport("user32.dll", SetLastError = true)] public static extern bool SetThreadDesktop(IntPtr hDesktop);
    [DllImport("user32.dll", SetLastError = true)] public static extern bool CloseDesktop(IntPtr hDesktop);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmd);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)] public static extern int GetClassName(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool EnumDesktopWindows(IntPtr hDesktop, EnumWindowsProc enumProc, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);

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
                        StringBuilder sbTitle = new StringBuilder(512);
                        GetWindowText(hWnd, sbTitle, 512);
                        StringBuilder sbClass = new StringBuilder(512);
                        GetClassName(hWnd, sbClass, 512);
                        string title = sbTitle.ToString();
                        string cls = sbClass.ToString();

                        if (cls == "Chrome_WidgetWin_1" && title == "Zalo") {
                            targetHwnd = hWnd;
                            targetPid = pid;
                            return false;
                        }
                        if (targetHwnd == IntPtr.Zero && cls == "Chrome_WidgetWin_1") {
                            targetHwnd = hWnd;
                            targetPid = pid;
                        }
                    }
                }
                return true;
            }, IntPtr.Zero);
            CloseDesktop(hDesk);
        }

        if (targetHwnd == IntPtr.Zero) {
            EnumWindows((hWnd, lParam) => {
                if (IsWindowVisible(hWnd)) {
                    uint pid;
                    GetWindowThreadProcessId(hWnd, out pid);
                    if (pids.Contains(pid)) {
                        StringBuilder sbTitle = new StringBuilder(512);
                        GetWindowText(hWnd, sbTitle, 512);
                        StringBuilder sbClass = new StringBuilder(512);
                        GetClassName(hWnd, sbClass, 512);
                        string title = sbTitle.ToString();
                        string cls = sbClass.ToString();

                        if (cls == "Chrome_WidgetWin_1" && title == "Zalo") {
                            targetHwnd = hWnd;
                            targetPid = pid;
                            return false;
                        }
                        if (targetHwnd == IntPtr.Zero && cls == "Chrome_WidgetWin_1") {
                            targetHwnd = hWnd;
                            targetPid = pid;
                        }
                    }
                }
                return true;
            }, IntPtr.Zero);
        }

        zaloPid = targetPid;
        return targetHwnd;
    }

    public static bool FocusZalo(out uint activePid) {
        bool success = false;
        uint outPid = 0;
        Thread t = new Thread(() => {
            IntPtr hWinsta = OpenWindowStation("winsta0", false, 0x037F);
            if (hWinsta != IntPtr.Zero) SetProcessWindowStation(hWinsta);
            IntPtr hDesk = OpenDesktop("default", 0, false, 0x01FF);
            if (hDesk != IntPtr.Zero) {
                SetThreadDesktop(hDesk);
            }

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
            SetForegroundWindow(hWnd);

            if (fgThread != zaloThread) {
                AttachThreadInput(currentThread, zaloThread, false);
                AttachThreadInput(fgThread, zaloThread, false);
            }

            Thread.Sleep(600);

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

# === Cơ chế Khóa Độc Quyền (Mutex/Lock) tránh xung đột giữa các báo cáo Zalo ===
$global:zaloLockFile = Join-Path $env:TEMP "zalo_automation_active.lock"
$global:zaloLockStream = $null

function Acquire-ZaloLock {
    param([int]$timeoutSeconds = 180)
    Write-Log "Dang cho khoa Zalo Lock doc quyen (tranh dung do voi cac bao cao khac)..."
    $startTime = Get-Date
    while ((Get-Date) - $startTime -lt [TimeSpan]::FromSeconds($timeoutSeconds)) {
        try {
            $stream = [System.IO.File]::Open($global:zaloLockFile, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
            $global:zaloLockStream = $stream
            Write-Log "Da lay duoc khoa Zalo Lock doc quyen."
            return $true
        } catch {
            try {
                if (Test-Path $global:zaloLockFile) {
                    $fi = Get-Item $global:zaloLockFile
                    if ((Get-Date) - $fi.LastWriteTime -gt [TimeSpan]::FromMinutes(10)) {
                        Remove-Item $global:zaloLockFile -Force -ErrorAction SilentlyContinue
                    }
                }
            } catch {}
            Start-Sleep -Seconds 2
        }
    }
    Write-Log "Qua thoi gian cho Zalo Lock ($timeoutSeconds s)!" "WARN"
    return $false
}

function Release-ZaloLock {
    try {
        if ($global:zaloLockStream) {
            $global:zaloLockStream.Close()
            $global:zaloLockStream.Dispose()
            $global:zaloLockStream = $null
        }
        if (Test-Path $global:zaloLockFile) {
            Remove-Item $global:zaloLockFile -Force -ErrorAction SilentlyContinue
        }
        Write-Log "Da giai phong khoa Zalo Lock."
    } catch {}
}

function Focus-Zalo {
    $activePid = 0
    $focusOk = [WinHelperMQAA]::FocusZalo([ref]$activePid)
    if (-not $focusOk) {
        $wshell = New-Object -ComObject WScript.Shell
        $wshell.AppActivate("Zalo") | Out-Null
        Start-Sleep -Milliseconds 800
        $focusOk = [WinHelperMQAA]::FocusZalo([ref]$activePid)
    }

    $allZaloPids = @((Get-Process -Name Zalo -ErrorAction SilentlyContinue).Id)
    if ($allZaloPids.Count -eq 0) {
        Write-Log "Khong tim thay ung dung Zalo dang chay tren may!" "ERROR"
        return $false
    }
    return $focusOk
}

# Hàm chuyển sang nhóm Zalo an toàn tuyệt đối
function Switch-ZaloGroup {
    param([string]$targetGroup)
    Write-Log "Dang chuyen sang nhom Zalo: '$targetGroup'..."
    $focusOk = Focus-Zalo
    if (-not $focusOk) {
        Write-Log "CANH BAO AN TOAN: Khong the focus cua so Zalo. Tu choi gui phim de tranh go nham!" "ERROR"
        return $false
    }

    # Đóng mọi search popup dở
    [System.Windows.Forms.SendKeys]::SendWait("{ESC}")
    Start-Sleep -Milliseconds 400

    # Mở ô tìm kiếm
    [System.Windows.Forms.SendKeys]::SendWait("^f")
    Start-Sleep -Milliseconds 800

    # Copy và dán tên nhóm
    for ($c = 0; $c -lt 5; $c++) {
        try {
            [System.Windows.Forms.Clipboard]::SetText($targetGroup, [System.Windows.Forms.TextDataFormat]::UnicodeText)
            break
        } catch { Start-Sleep -Milliseconds 200 }
    }
    [System.Windows.Forms.SendKeys]::SendWait("^v")
    Start-Sleep -Seconds 2

    # Nhấn Enter để vào nhóm (Tuyệt đối không dùng DOWN)
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Start-Sleep -Seconds 2

    # Thoát thanh tìm kiếm để focus vào ô soạn thảo tin nhắn
    [System.Windows.Forms.SendKeys]::SendWait("{ESC}")
    Start-Sleep -Milliseconds 600

    Write-Log "Da chuyen thanh cong vao nhom: '$targetGroup'"
    return $true
}

# Các nhãn tiếng Việt
$L_SEP        = "-----------------------"
$DASHBOARD_LINK = "https://kpi-app-ckg6.vercel.app/mqaa-dashboard"

# Emojis
$E_USER     = [char]0xD83D + [char]0xDC64
$E_WARNING  = [char]0x26A0 + [char]0xFE0F
$E_BLUE_DOT = [char]0xD83D + [char]0xDD39
$starEmoji  = [char]0xD83D + [char]0xDCAF

function Send-ZaloMessage {
    param([string]$text)
    Focus-Zalo | Out-Null
    for ($i = 0; $i -lt 5; $i++) {
        try {
            [System.Windows.Forms.Clipboard]::SetText($text, [System.Windows.Forms.TextDataFormat]::UnicodeText)
            break
        } catch {
            Start-Sleep -Milliseconds 300
        }
    }
    Start-Sleep -Milliseconds 200
    [System.Windows.Forms.SendKeys]::SendWait("^v")
    Start-Sleep -Seconds 2
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Start-Sleep -Seconds 2
}

function Send-ZaloImageGroup {
    param([string[]]$imageUrls)
    if ($imageUrls.Count -eq 0) { return }
    $tempFolder = Join-Path $env:TEMP ("mqaa_group_" + (Get-Date -Format "yyyyMMdd_HHmmss") + "_" + (Get-Random))
    $null = New-Item -ItemType Directory -Path $tempFolder -Force
    $filePaths = New-Object System.Collections.Specialized.StringCollection
    try {
        foreach ($url in $imageUrls) {
            $fileName  = [System.IO.Path]::GetFileName(([uri]$url).AbsolutePath)
            if (-not $fileName) { $fileName = "image_$(Get-Random).jpg" }
            $localPath = Join-Path $tempFolder $fileName
            Invoke-WebRequest -Uri $url -OutFile $localPath -UserAgent "Mozilla/5.0"
            if (Test-Path $localPath) { [void]$filePaths.Add($localPath) }
        }
        Focus-Zalo | Out-Null
        $setOk = $false
        for ($i = 0; $i -lt 5; $i++) {
            try {
                [System.Windows.Forms.Clipboard]::SetFileDropList($filePaths)
                $setOk = $true
                break
            } catch {
                Start-Sleep -Milliseconds 500
            }
        }
        if (-not $setOk) {
            Write-Log "Khong the copy hinh anh vao Clipboard de gui Zalo" "WARN"
            return
        }
        Start-Sleep -Milliseconds 300
        [System.Windows.Forms.SendKeys]::SendWait("^v")
        Start-Sleep -Milliseconds 3000
        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
        Start-Sleep -Seconds 3
    }
    finally { if (Test-Path $tempFolder) { Remove-Item -Path $tempFolder -Recurse -Force -ErrorAction SilentlyContinue } }
}

try {
    $todayStr    = Get-Date -Format "yyyy-MM-dd"
    $currentTime = Get-Date -Format "HH:mm"
    $headers     = @{ "apikey" = $SUPABASE_KEY; "Authorization" = "Bearer $SUPABASE_KEY" }

    Write-Log "=== BAT DAU CHAY MQAA Automation ==="

    # Khoa Zalo Lock tranh xung dot voi cac bao cao khac
    $lockAcquired = Acquire-ZaloLock -timeoutSeconds 180
    if (-not $lockAcquired) {
        Write-Log "Khong the lay Zalo Lock doc quyen sau 180s vi co tien trinh khac dang dung Zalo. Thoat de tranh xung dot." "ERROR"
        exit 1
    }

    # 1. Lấy cấu hình hệ thống
    $settingsUrl = "$SUPABASE_URL/rest/v1/mqaa_settings?id=eq.1"
    $settings    = Invoke-RestMethod -Uri $settingsUrl -Headers $headers -Method Get

    if ($settings) {
        $ZALO_GROUP_NAME    = if ($settings[0].zalo_group)          { $settings[0].zalo_group }          else { $ZALO_GROUP_NAME }
        $REPORT_TIME        = if ($settings[0].report_time)          { $settings[0].report_time }          else { $DEFAULT_REPORT_TIME }
        $PATROL_ZALO_GROUP  = if ($settings[0].patrol_zalo_group)    { $settings[0].patrol_zalo_group }    else { $ZALO_GROUP_NAME }
        $PATROL_REPORT_TIME = if ($settings[0].patrol_report_time -and $settings[0].patrol_report_time.Trim() -ne "") { $settings[0].patrol_report_time } else { $REPORT_TIME }
        Write-Log "Settings: ZaloGroup='$ZALO_GROUP_NAME' | PatrolGroup='$PATROL_ZALO_GROUP' | PatrolTime='$PATROL_REPORT_TIME' | LastPatrol='$($settings[0].last_patrol_report_monday)'"

        # Kiểm tra Zalo đang mở
        Write-Log "Dang kiem tra Zalo PC..."
        $allZalo = Get-Process -Name Zalo -ErrorAction SilentlyContinue
        if (-not $allZalo -or $allZalo.Count -eq 0) {
            $zaloExe = "C:\Users\prod.public\AppData\Local\Programs\Zalo\Zalo.exe"
            if (Test-Path $zaloExe) {
                Write-Log "Zalo chua mo, dang tu dong khoi dong Zalo..."
                Start-Process $zaloExe
                Start-Sleep -Seconds 5
                $allZalo = Get-Process -Name Zalo -ErrorAction SilentlyContinue
            }
        }
        if (-not $allZalo -or $allZalo.Count -eq 0) {
            Write-Log "LOI: Zalo PC chua mo." "ERROR"
            throw "Hay mo Zalo PC truoc khi chay script!"
        }
        $zaloProcess = $allZalo | Where-Object { $_.MainWindowTitle } | Select-Object -First 1
        if (-not $zaloProcess) { $zaloProcess = $allZalo[0] }
        Write-Log "Zalo dang chay: $($allZalo.Count) processes | PID=$($zaloProcess.Id) | Title='$($zaloProcess.MainWindowTitle)'"

        # Lưu handle
        $script:zaloHandle = $zaloProcess.MainWindowHandle
        $script:myHandle   = (Get-Process -Id $PID).MainWindowHandle

        # Focus Zalo
        Write-Log "Focus Zalo..."
        Focus-Zalo | Out-Null
        Start-Sleep -Seconds 2

        $sysSettings = $null
        try {
            $sysData = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/system_settings?id=eq.1" -Headers $headers -Method Get
            if ($sysData) { $sysSettings = $sysData[0] }
        } catch {}

        $isMqaaEnabled = $sysSettings.is_mqaa_patrol_enabled -ne $false
        $isWipEnabled = $sysSettings.is_wip_enabled -ne $false

        $runPatrol = ($TargetReport -eq "mqaa_patrol") -or (-not $ManualTrigger -and $isMqaaEnabled -and $currentTime -ge $PATROL_REPORT_TIME)
        $runWip = $false # ($TargetReport -eq "wip_report") -or (-not $ManualTrigger -and $isWipEnabled -and (Get-Date).Hour -eq 8)

        # ============================================
        # PHẦN B: BÁO CÁO PATROL MQAA
        # ============================================
        if ($runPatrol) {
            $yesterdayDate = if ($TargetDate) { [DateTime]::ParseExact($TargetDate, "yyyy-MM-dd", $null) } else { (Get-Date).AddDays(-1).Date }
            $yesterdayStr  = $yesterdayDate.ToString("yyyy-MM-dd")
            $lastSentDate  = $settings[0].last_patrol_report_monday
            if ($ManualTrigger -or $lastSentDate -ne $yesterdayStr) {
                if ($ManualTrigger -and $lastSentDate -eq $yesterdayStr) {
                    Write-Log "Kich hoat thu cong: Cho phep gui lai bao cao Patrol ngay $yesterdayStr (du da gui truoc do)..."
                } else {
                    Write-Log ">>> Bat dau gui bao cao Patrol ngay $yesterdayStr..."
                }
                $patrolUrl  = "$SUPABASE_URL/rest/v1/mqaa_patrol_logs?date=eq.$yesterdayStr&select=auditor_name,auditor_id,date,section,overall_performance,evaluation_data"
                $patrolData = Invoke-RestMethod -Uri $patrolUrl -Headers $headers -Method Get

                if ($patrolData -and $patrolData.Count -gt 0) {
                    $allSections = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/mqaa_patrol_sections?select=name&order=sort_order.asc" -Headers $headers -Method Get

                    # Chuyển sang nhóm Zalo Patrol an toàn (Tự động hủy nếu không chuyển được để tránh gửi nhầm nhóm)
                    $swOk = Switch-ZaloGroup -targetGroup $PATROL_ZALO_GROUP
                    if (-not $swOk) {
                        Write-Log "CANH BAO NGUY HIEM: Khong the chuyen sang nhom '$PATROL_ZALO_GROUP'. HUY BO GUI TIN DE TRANH GUI NHAM NHOM!" "ERROR"
                        return
                    }

                    $titlePatrol   = [char]0xD83D + [char]0xDCCB + " PHI" + [char]0x1EBE + "U T" + [char]0x1ED4 + "NG K" + [char]0x1EBE + "T MQAA"
                    $subTitleDaily = "(Ng" + [char]0x00E0 + "y: " + $yesterdayDate.ToString("dd/MM/yyyy") + ")"

                    # 1. Gửi phiếu riêng lẻ từng Auditor
                    $auditorGroups = $patrolData | Group-Object auditor_id
                    foreach ($auditorGroup in $auditorGroups) {
                        $auditorName   = $auditorGroup.Group[0].auditor_name
                        $evidenceItems = @()
                        $patrolMsg     = "$titlePatrol`n$E_USER Auditor: $auditorName - Ng" + [char]0x00E0 + "y: $($yesterdayDate.ToString("dd/MM"))`n$subTitleDaily`n$L_SEP`n"
                        $totalSum = 0; $count = 0
                        $secGroups = $auditorGroup.Group | Group-Object { $_.section.Replace("_", " ") }
                        foreach ($sg in $secGroups) {
                            $score = [Math]::Round(($sg.Group | Measure-Object overall_performance -Average).Average, 1)
                            $patrolMsg += "$E_BLUE_DOT $($sg.Name): $score%`n"
                            $totalSum += $score; $count++
                            if ($score -lt 100) {
                                foreach ($rec in $sg.Group) {
                                    if ($rec.evaluation_data) {
                                        foreach ($item in $rec.evaluation_data) {
                                            $isHeader = if ($item.is_header -ne $null) { $item.is_header } else { $item.isHeader }
                                            if (-not $isHeader) {
                                                $levelNum = 0
                                                $scoreNum = 0
                                                $canParseLevel = [double]::TryParse([string]$item.level, [ref]$levelNum)
                                                $canParseScore = [double]::TryParse([string]$item.score, [ref]$scoreNum)
                                                
                                                if ($canParseLevel -and $canParseScore -and $levelNum -lt $scoreNum) {
                                                    $desc = if ($item.description) { $item.description } else { $item.label }
                                                    $evidenceItems += [PSCustomObject]@{ Section = $sg.Name; Text = $desc; Image = $item.image_url }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        $patrolMsg += "$L_SEP`n$starEmoji Performance: " + ([Math]::Round($totalSum/$count, 1)) + "%"
                        if ($evidenceItems.Count -gt 0) {
                            $patrolMsg += "`n`n$E_WARNING *CHI TI" + [char]0x1EBE + "T C" + [char]0x00C1 + "C L" + [char]0x1ED6 + "I:*`n"
                            $imgs = @()
                            foreach ($ev in $evidenceItems) {
                                $patrolMsg += "- **$($ev.Section)**: $($ev.Text)`n"
                                if ($ev.Image) { $imgs += $ev.Image }
                            }
                            Send-ZaloMessage -text $patrolMsg
                            if ($imgs.Count -gt 0) { Send-ZaloImageGroup -imageUrls ($imgs | Select-Object -Unique) }
                        } else {
                            Send-ZaloMessage -text $patrolMsg
                        }
                        Write-Log "Da gui phieu auditor: $auditorName"
                    }

                    # 2. Bảng tổng kết ngày
                    $sumMsg  = "$titlePatrol`nT" + [char]0x1ED4 + "NG K" + [char]0x1EBE + "T B" + [char]0x1ED8 + " PH" + [char]0x1EAC + "N TRONG NG" + [char]0x00C0 + "Y`n$subTitleDaily`n$L_SEP`n"
                    $oSum = 0; $oCount = 0
                    $dStats = $patrolData | Group-Object { $_.section.Replace("_", " ") }
                    foreach ($sec in $allSections) {
                        $match = $dStats | Where-Object { $_.Name -eq $sec.name }
                        if ($match) {
                            $score   = [Math]::Round(($match.Group | Measure-Object overall_performance -Average).Average, 1)
                            $sumMsg += "$E_BLUE_DOT $($sec.name): $score%`n"
                            $oSum += $score; $oCount++
                        } else { $sumMsg += "$E_BLUE_DOT $($sec.name): ...`n" }
                    }
                    $sumMsg += "$L_SEP`n$starEmoji Overall Daily Performance: " + ([Math]::Round($oSum/$oCount, 1)) + "%"
                    Send-ZaloMessage -text $sumMsg
                    Write-Log "Da gui bang tong ket ngay."

                    # 3. Tổng kết tuần (Chỉ Thứ 7)
                    if ((Get-Date).DayOfWeek -eq [System.DayOfWeek]::Saturday) {
                        $monDate = (Get-Date).AddDays( - (([int](Get-Date).DayOfWeek - 1 + 7) % 7)).Date
                        $wUrl    = "$SUPABASE_URL/rest/v1/mqaa_patrol_logs?date=gte.$($monDate.ToString("yyyy-MM-dd"))&date=lte.$todayStr&select=overall_performance,section"
                        $wData   = Invoke-RestMethod -Uri $wUrl -Headers $headers -Method Get
                        if ($wData) {
                            $wMsg   = "$titlePatrol`nT" + [char]0x1ED4 + "NG K" + [char]0x1EBE + "T MQAA TRONG TU" + [char]0x1EA6 + "N`n(Tuan tu " + $monDate.ToString("dd/MM") + " den " + (Get-Date).ToString("dd/MM") + ")`n$L_SEP`n"
                            $wStats = $wData | Group-Object { $_.section.Replace("_", " ") }
                            $ws = 0; $wc = 0
                            foreach ($sec in $allSections) {
                                $m = $wStats | Where-Object { $_.Name -eq $sec.name }
                                if ($m) {
                                    $score  = [Math]::Round(($m.Group | Measure-Object overall_performance -Average).Average, 1)
                                    $wMsg  += "$E_BLUE_DOT $($sec.name): $score%`n"
                                    $ws += $score; $wc++
                                } else { $wMsg += "$E_BLUE_DOT $($sec.name): ...`n" }
                            }
                            $wMsg += "$L_SEP`n$starEmoji Weekly Overall: " + ([Math]::Round($ws/$wc, 1)) + "%"
                            Send-ZaloMessage -text $wMsg
                            Write-Log "Da gui tong ket tuan."
                        }
                    }

                    # Cập nhật trạng thái
                    $null = Invoke-RestMethod -Uri $settingsUrl -Headers $headers -Method Patch -Body ('{"last_patrol_report_monday":"' + $yesterdayStr + '"}') -ContentType "application/json"
                    Write-Log "Da cap nhat last_patrol_report_monday = $yesterdayStr"
                } else {
                    Write-Log "Khong co du lieu Patrol cho ngay $yesterdayStr. Bo qua." "WARN"
                }
            } else {
                Write-Log "Bao cao Patrol ngay $yesterdayStr DA DUOC GUI TRUOC DO. Bo qua." "WARN"
            }
        } else {
            Write-Log "Chua den gio gui bao cao ($currentTime < $PATROL_REPORT_TIME). Bo qua." "WARN"
        }
    }
    # ============================================
    # PHẦN C: BÁO CÁO WIP (08:00)
    # ============================================
    if ($runWip) {
        Write-Log "Kiem tra thoi gian: 8h - Bat dau doc va gui bao cao WIP..."
        $ORIGINAL_WIP_EXCEL_PATH = "C:\Users\prod.public\Ortholite Vietnam\OVN Production - Documents\PRODUCTION\Nhân Lg\Schedule\Ovn Pro Schedule.xlsb"
        $WIP_EXCEL_PATH = "$env:TEMP\Ovn_Pro_Schedule_Temp.xlsb"
        Copy-Item -Path $ORIGINAL_WIP_EXCEL_PATH -Destination $WIP_EXCEL_PATH -Force
        if (Test-Path $WIP_EXCEL_PATH) {
            $excelWIP = New-Object -ComObject Excel.Application
            $excelWIP.Visible = $false
            $excelWIP.DisplayAlerts = $false
            try {
                $wbWIP = $excelWIP.Workbooks.Open($WIP_EXCEL_PATH, 0, $true)
                $shWIP = $null
                try { $shWIP = $wbWIP.Sheets.Item("Record Wip (Old)") } catch {}
                if (-not $shWIP) {
                    try { $shWIP = $wbWIP.Sheets.Item("Record Wip") } catch {}
                }
                
                # Luôn lấy data dòng thứ 2 (dữ liệu realtime hiện tại)
                $wipRow = 2
                
                $colNames = @($shWIP.Cells.Item(1,2).Text.Trim(), $shWIP.Cells.Item(1,3).Text.Trim(), $shWIP.Cells.Item(1,4).Text.Trim(), $shWIP.Cells.Item(1,5).Text.Trim(), $shWIP.Cells.Item(1,6).Text.Trim(), $shWIP.Cells.Item(1,7).Text.Trim(), $shWIP.Cells.Item(1,8).Text.Trim())
                
                $wipValues = @()
                for ($c = 2; $c -le 8; $c++) {
                    $valText = $shWIP.Cells.Item($wipRow, $c).Text
                    $valNum = 0
                    if (-not [string]::IsNullOrWhiteSpace($valText)) {
                        $valText = $valText -replace '[^\d\.-]', ''
                        if ($valText) { [double]::TryParse($valText, [ref]$valNum) | Out-Null }
                    }
                    $wipValues += $valNum
                }
                
                # Đọc dữ liệu từ sheet RECORD WIP cho báo cáo WIP NEW TARGET
                $shRecordWip = $null
                try { $shRecordWip = $wbWIP.Sheets.Item("RECORD WIP") } catch {}
                if (-not $shRecordWip) {
                    try { $shRecordWip = $wbWIP.Sheets.Item("Record Wip") } catch {}
                }
                
                $laminationNew = 0
                $leanDcNew = 0
                $prefittingNew = 0
                $moldingNew = 0
                $leanMoldedNew = 0

                if ($shRecordWip) {
                    # Format mới (ngang: Row 1 Header, Row 4 Ghi chú, Row 2 Giá trị các cột)
                    for ($c = 1; $c -le 10; $c++) {
                        $secName = ($shRecordWip.Cells.Item(1, $c).Text + " " + $shRecordWip.Cells.Item(4, $c).Text).Trim()
                        $valText = $shRecordWip.Cells.Item(2, $c).Text
                        $valNum = 0
                        if (-not [string]::IsNullOrWhiteSpace($valText)) {
                            $valText = $valText -replace '[^\d\.-]', ''
                            if ($valText) { [double]::TryParse($valText, [ref]$valNum) | Out-Null }
                        }
                        
                        if ($secName -like "*1.MATERIAL*" -or $secName -like "*LAMINATION*") {
                            $laminationNew = $valNum
                        } elseif ($secName -like "*2.WIP*" -or $secName -like "*DIE CUT*" -or $secName -like "*Leanline DC*") {
                            $leanDcNew = $valNum
                        } elseif ($secName -like "*3.WIP*" -or $secName -like "*PREFITTING*" -or $secName -like "*Prefitting*") {
                            $prefittingNew = $valNum
                        } elseif ($secName -like "*4.WIP*" -or ($secName -like "*MOLDING*" -and $secName -notlike "*LEAN*")) {
                            $moldingNew = $valNum
                        } elseif ($secName -like "*5.WIP*" -or $secName -like "*LEAN LINE MOLDED*" -or $secName -like "*Leanline Molded*") {
                            $leanMoldedNew = $valNum
                        }
                    }

                    # Fallback nếu format cũ (dọc: Row 2->10, Col 1 = Name, Col 2 = Value)
                    if ($laminationNew -eq 0 -and $leanDcNew -eq 0 -and $prefittingNew -eq 0 -and $moldingNew -eq 0 -and $leanMoldedNew -eq 0) {
                        for ($r = 2; $r -le 10; $r++) {
                            $secName = $shRecordWip.Cells.Item($r, 1).Text
                            $valText = $shRecordWip.Cells.Item($r, 2).Text
                            $valNum = 0
                            if (-not [string]::IsNullOrWhiteSpace($valText)) {
                                $valText = $valText -replace '[^\d\.-]', ''
                                if ($valText) { [double]::TryParse($valText, [ref]$valNum) | Out-Null }
                            }
                            
                            if ($secName -like "*1.MATERIAL*" -or $secName -like "*LAMINATION*") {
                                $laminationNew = $valNum
                            } elseif ($secName -like "*2.WIP*" -or $secName -like "*DIE CUT*") {
                                $leanDcNew = $valNum
                            } elseif ($secName -like "*3.WIP*" -or $secName -like "*PREFITTING*") {
                                $prefittingNew = $valNum
                            } elseif ($secName -like "*4.WIP*" -or ($secName -like "*MOLDING*" -and $secName -notlike "*LEAN LINE*")) {
                                $moldingNew = $valNum
                            } elseif ($secName -like "*5.WIP*" -or $secName -like "*LEAN LINE MOLDED*") {
                                $leanMoldedNew = $valNum
                            }
                        }
                    }
                }
                
                $wbWIP.Close($false)
                $excelWIP.Quit()
                [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excelWIP) | Out-Null
                $excelWIP = $null
                
                $lamination = $wipValues[0] + $wipValues[1]
                $prefitting = $wipValues[2]
                $molding = $wipValues[3]
                $leanMolded = $wipValues[4] + ($wipValues[5] * 0.6) + $wipValues[6]
                $leanDc = $wipValues[5] * 0.4
                $totalActual = $lamination + $prefitting + $molding + $leanMolded + $leanDc
                
                function Get-WipSectionTextMQAA($name, $actual, $target) {
                    $diff = $actual - $target
                    $fmtActual = "{0:N0}" -f $actual
                    $fmtDiff = "{0:N0}" -f [math]::Abs($diff)
                    $fmtTarget = "{0:N0}" -f $target
                    if ($diff -gt 0) { return "$($name) (Target $fmtTarget): $fmtActual Pairs (Vượt $fmtDiff Pairs so với Target)`n" }
                    elseif ($diff -lt 0) { return "$($name) (Target $fmtTarget): $fmtActual Pairs (Thấp hơn $fmtDiff Pairs so với Target)`n" }
                    else { return "$($name) (Target $fmtTarget): $fmtActual Pairs (Đạt đúng Target)`n" }
                }

                $currentTimeStr = Get-Date -Format "HH:mm dd/MM/yy"
                $wipMsg = "Báo cáo tình hình WIP đến thời điểm ${currentTimeStr}:`n"
                $wipMsg += Get-WipSectionTextMQAA "1. LAMINATION" $lamination 670000
                $wipMsg += Get-WipSectionTextMQAA "2. PREFITTING" $prefitting 250000
                $wipMsg += Get-WipSectionTextMQAA "3. MOLDING" $molding 260000
                $wipMsg += Get-WipSectionTextMQAA "4. LEANLINE MOLDED" $leanMolded 500000
                $wipMsg += Get-WipSectionTextMQAA "5. LEANLINE DC" $leanDc 220000
                
                $totalActualF = "{0:N0}" -f $totalActual
                $wipMsg += "Total WIP (1->5): $totalActualF Pairs`n"
                
                $targetTotal = 1900000
                if ($totalActual -gt $targetTotal) {
                    $diff = "{0:N0}" -f ($totalActual - $targetTotal)
                    $wipMsg += "Nhận xét: Tổng WIP (1->5) hiện tại đang VƯỢT target $diff Pairs. Cần chú ý giảm WIP!"
                } elseif ($totalActual -lt $targetTotal) {
                    $diff = "{0:N0}" -f ($targetTotal - $totalActual)
                    $wipMsg += "Nhận xét: Tổng WIP (1->5) hiện tại đang THẤP HƠN target $diff Pairs. Đang kiểm soát tốt!"
                } else {
                    $wipMsg += "Nhận xét: Tổng WIP (1->5) hiện tại ĐẠT ĐÚNG target 1,900,000 Pairs."
                }

                # Tạo tin nhắn báo cáo WIP NEW TARGET
                $wipNewMsg = "Báo cáo tình hình WIP NEW TARGET đến thời điểm ${currentTimeStr}:`n"
                $wipNewMsg += Get-WipSectionTextMQAA "1. Lamination" $laminationNew 450000
                $wipNewMsg += Get-WipSectionTextMQAA "2. Prefitting" $prefittingNew 200000
                $wipNewMsg += Get-WipSectionTextMQAA "3. Molding" $moldingNew 400000
                $wipNewMsg += Get-WipSectionTextMQAA "4. Leanline DC" $leanDcNew 300000
                $wipNewMsg += Get-WipSectionTextMQAA "5. Leanline Molded" $leanMoldedNew 550000
                
                $totalActualNew = $laminationNew + $prefittingNew + $moldingNew + $leanDcNew + $leanMoldedNew
                $totalActualNewF = "{0:N0}" -f $totalActualNew
                $wipNewMsg += "Total WIP (1->5): $totalActualNewF Pairs`n"
                
                $targetTotalNew = 1900000
                if ($totalActualNew -gt $targetTotalNew) {
                    $diffNew = "{0:N0}" -f ($totalActualNew - $targetTotalNew)
                    $wipNewMsg += "Nhận xét: Tổng WIP (1->5) hiện tại đang VƯỢT target $diffNew Pairs. Cần chú ý giảm WIP!"
                } elseif ($totalActualNew -lt $targetTotalNew) {
                    $diffNew = "{0:N0}" -f ($targetTotalNew - $totalActualNew)
                    $wipNewMsg += "Nhận xét: Tổng WIP (1->5) hiện tại đang THẤP HƠN target $diffNew Pairs. Đang kiểm soát tốt!"
                } else {
                    $wipNewMsg += "Nhận xét: Tổng WIP (1->5) hiện tại ĐẠT ĐÚNG target 1,900,000 Pairs."
                }
                
                Write-Log "Da tao xong bao cao WIP & WIP NEW TARGET."
                
                $WIP_TARGET = "Daily Report"
                # Chuyển Zalo Target an toàn
                $swWipOk = Switch-ZaloGroup -targetGroup $WIP_TARGET
                if (-not $swWipOk) {
                    Write-Log "CANH BAO: Khong the chuyen sang nhom '$WIP_TARGET'. Bo qua gui WIP!" "ERROR"
                } else {
                    Send-ZaloMessage -text $wipMsg
                    Write-Log "Da gui bao cao WIP vao $WIP_TARGET."

                    Start-Sleep -Seconds 2
                    Send-ZaloMessage -text $wipNewMsg
                    Write-Log "Da gui bao cao WIP NEW TARGET vao $WIP_TARGET."
                }
                
            } catch {
                Write-Log "Loi tao bao cao WIP: $_" "ERROR"
                if ($excelWIP) { try { $excelWIP.Quit(); [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excelWIP) | Out-Null } catch {} }
            }
        } else {
            Write-Log "Khong tim thay file WIP: $WIP_EXCEL_PATH" "ERROR"
        }
    }

    Write-Log "=== HOAN TAT ==="
} catch {
    Write-Log "LOI NGHIEM TRONG: $_" "ERROR"
    Write-Error "Loi: $_"
    exit 1
}

finally {
    Release-ZaloLock
    & (Join-Path $PSScriptRoot "Cleanup-Excel.ps1")
}
