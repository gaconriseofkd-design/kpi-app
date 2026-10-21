# scripts/Send_Employees_Voice.ps1
# Script tự động đọc file 'Tiếng Nói Từ Hiện Trường Sản Xuất.xlsx' trong thư mục 'Nhân Lg\Document' (hoặc fallback 'INFORMATION CHANEL')
# và gửi báo cáo phản ánh của nhân viên vào nhóm Zalo (Hàng ngày lúc 08:00 + Tổng kết tuần vào Thứ 7).
# Có cơ chế lưu tracking ID (employees_voice_sent_ids.json) đảm bảo không bị sót và không bị trùng lặp.

param(
    [switch]$ManualTrigger,
    [string]$Action = "AutoCheck",  # "AutoCheck", "WeeklySummary", "SendAllUnsent"
    [switch]$TestOnly              # Chỉ in nội dung ra màn hình, không gửi Zalo
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$ZALO_GROUP_NAME = "Employees voice"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$TRACKING_FILE = Join-Path $scriptDir "employees_voice_sent_ids.json"
$LOG_FILE = Join-Path $scriptDir "employees_voice.log"

function Write-Log {
    param([string]$msg, [string]$level = "INFO")
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$ts] [$level] $msg"
    try { Add-Content -Path $LOG_FILE -Value $line -Encoding UTF8 } catch {}
    if ($level -eq "ERROR") { Write-Host $line -ForegroundColor Red }
    elseif ($level -eq "WARN") { Write-Host $line -ForegroundColor Yellow }
    else { Write-Host $line -ForegroundColor Cyan }
}

# Win32 API hỗ trợ tìm kiếm và kích hoạt cửa sổ Zalo chính xác
$win32Src = @"
using System;
using System.Text;
using System.Threading;
using System.Diagnostics;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public class WinHelperVoice {
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmd);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)] public static extern int GetClassName(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll", SetLastError = true)] public static extern IntPtr OpenDesktop(string lpszDesktop, uint dwFlags, bool fInherit, uint dwDesiredAccess);
    [DllImport("user32.dll", SetLastError = true)] public static extern bool SetThreadDesktop(IntPtr hDesktop);
    [DllImport("user32.dll", SetLastError = true)] public static extern bool CloseDesktop(IntPtr hDesktop);

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);

    public static IntPtr FindVisibleZalo(out uint zaloPid) {
        uint targetPid = 0;
        IntPtr targetHwnd = IntPtr.Zero;

        Process[] procs = Process.GetProcessesByName("Zalo");
        HashSet<uint> pids = new HashSet<uint>();
        foreach (Process p in procs) { pids.Add((uint)p.Id); }

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

        zaloPid = targetPid;
        return targetHwnd;
    }

    public static bool FocusZalo(out uint activePid) {
        bool success = false;
        uint outPid = 0;
        Thread t = new Thread(() => {
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

function Send-ZaloMessageVoice ($text) {
    if ($TestOnly) {
        Write-Host "`n[TEST MODE - KHONG GUI ZALO] Noi dung tin nhan:" -ForegroundColor Yellow
        Write-Host $text -ForegroundColor Green
        return $false
    }

    Write-Log "Dang tim va kich hoat cua so Zalo PC..."
    $activePid = 0
    $focusOk = [WinHelperVoice]::FocusZalo([ref]$activePid)

    # Thử lại thêm 1 lần với WScript.Shell AppActivate nếu chưa focus được
    if (-not $focusOk) {
        Write-Log "Thu lai focus bang WScript.Shell AppActivate..." "WARN"
        $wshell = New-Object -ComObject WScript.Shell
        $wshell.AppActivate("Zalo") | Out-Null
        Start-Sleep -Milliseconds 800
        $focusOk = [WinHelperVoice]::FocusZalo([ref]$activePid)
    }

    # KIỂM TRA AN TOÀN TUYỆT ĐỐI:
    # Nếu cửa sổ foreground KHÔNG phải là tiến trình Zalo, KHÔNG ĐƯỢC PHÉP gửi phím bấm (tránh ấn Ctrl+F nhầm vào Explorer)!
    $allZaloPids = @((Get-Process -Name Zalo -ErrorAction SilentlyContinue).Id)
    if ($allZaloPids.Count -eq 0) {
        Write-Log "Khong tim thay ung dung Zalo dang chay tren may!" "ERROR"
        return $false
    }

    if (-not ($allZaloPids -contains $activePid)) {
        Write-Log "CANH BAO AN TOAN: Khong the lay Focus cua so Zalo (PID hien tai dang focus la $activePid khong thuoc Zalo). Tu choi gui phim bam de tranh go nham!" "ERROR"
        return $false
    }

    Write-Log "Da focus thanh cong cua so Zalo (PID: $activePid). Bat dau tim nhom va gui tin..."
    Start-Sleep -Milliseconds 500

    # Tim nhom Zalo
    [System.Windows.Forms.SendKeys]::SendWait("^f")
    Start-Sleep -Milliseconds 800
    [System.Windows.Forms.Clipboard]::SetText($ZALO_GROUP_NAME, [System.Windows.Forms.TextDataFormat]::UnicodeText)
    [System.Windows.Forms.SendKeys]::SendWait("^v")
    Start-Sleep -Seconds 2
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Start-Sleep -Seconds 2

    # Dan noi dung tin nhan
    [System.Windows.Forms.Clipboard]::SetText($text, [System.Windows.Forms.TextDataFormat]::UnicodeText)
    [System.Windows.Forms.SendKeys]::SendWait("^v")
    Start-Sleep -Milliseconds 600
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Start-Sleep -Seconds 1
    return $true
}

# Ham lam sach text tuy chon (vi du "2. Gui an danh" -> "Gui an danh")
function Clean-OptionText ($text) {
    if ([string]::IsNullOrWhiteSpace($text)) { return "" }
    $clean = $text -replace "^\s*\d+[\.\)]\s*", ""
    return $clean.Trim()
}

# Doc hoac khoi tao tracking file
function Get-TrackingData {
    $default = [PSCustomObject]@{
        sent_ids                 = @()
        last_run                 = $null
        last_reminder_date       = $null
        last_weekly_summary_week = $null
    }
    if (Test-Path $TRACKING_FILE) {
        try {
            $raw = Get-Content -Path $TRACKING_FILE -Raw -Encoding UTF8
            $obj = $raw | ConvertFrom-Json
            if ($null -ne $obj) {
                if ($null -ne $obj.sent_ids) { $default.sent_ids = @($obj.sent_ids) }
                if ($null -ne $obj.last_run) { $default.last_run = $obj.last_run }
                if ($null -ne $obj.last_reminder_date) { $default.last_reminder_date = $obj.last_reminder_date }
                if ($null -ne $obj.last_weekly_summary_week) { $default.last_weekly_summary_week = $obj.last_weekly_summary_week }
            }
            return $default
        } catch {
            Write-Log "Loi doc file tracking, tao moi." "WARN"
        }
    }
    return $default
}

function Set-TrackingProperty ($obj, [string]$propName, $val) {
    if ($obj.PSObject.Properties[$propName]) {
        $obj.$propName = $val
    } else {
        $obj | Add-Member -NotePropertyName $propName -NotePropertyValue $val -Force
    }
}

function Save-TrackingData ($data) {
    try {
        $json = $data | ConvertTo-Json -Depth 5
        [System.IO.File]::WriteAllText($TRACKING_FILE, $json, [System.Text.Encoding]::UTF8)
    } catch {
        Write-Log "Loi khi luu tracking file: $_" "ERROR"
    }
}

# Tim file Excel 'Tiếng Nói Từ Hiện Trường Sản Xuất.xlsx'
$targetFolders = @(
    "C:\Users\prod.public\Ortholite Vietnam\OVN Production - Documents\PRODUCTION\Nhân Lg\Document",
    (Join-Path $scriptDir "..\INFORMATION CHANEL")
)

$voiceFile = $null
foreach ($dir in $targetFolders) {
    if (Test-Path -LiteralPath $dir) {
        $found = Get-ChildItem -LiteralPath $dir -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "*Ti*ng*N*i*.xlsx" } | Select-Object -First 1
        if (-not $found) {
            $found = Get-ChildItem -LiteralPath $dir -ErrorAction SilentlyContinue | Where-Object { $_.Extension -ieq ".xlsx" } | Select-Object -First 1
        }
        if ($found) {
            $voiceFile = $found
            break
        }
    }
}

if (-not $voiceFile) {
    Write-Log "Khong tim thay file Excel Tieng Noi trong: $($targetFolders -join ', ')" "ERROR"
    exit 1
}

Write-Log "Tim thay file Excel: $($voiceFile.FullName)"

# Doc du lieu tu file Excel
$excel = $null
$wb = $null
$records = @()

try {
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false

    $wb = $excel.Workbooks.Open($voiceFile.FullName, 0, $true) # Mo che do ReadOnly
    $ws = $wb.Sheets.Item(1)
    
    $lastRow = $ws.Cells.Item($ws.Rows.Count, 1).End(-4162).Row
    $lastCol = $ws.Cells.Item(1, $ws.Columns.Count).End(-4159).Column

    Write-Log "Tong so dong du lieu trong Excel: $lastRow (Cot: $lastCol)"

    # Xac dinh cot 'Xac nhan trang thai' (Cot 19 / S) va 'Noi dung xu ly' (Cot 20 / T)
    $statusCol = 0
    $solutionCol = 0
    for ($c = 1; $c -le $lastCol; $c++) {
        $headerText = $ws.Cells.Item(1, $c).Text.Trim()
        if ($headerText -match "Xác nhận trạng thái|trạng thái|trang thai|xac nhan|status") {
            $statusCol = $c
        }
        if ($headerText -match "Nội dung xử lí|nội dung xử lý|noi dung xu ly|nội dung giải quyết|kết quả xử lý|solution|resolution") {
            $solutionCol = $c
        }
    }
    if ($statusCol -eq 0 -and $lastCol -ge 19) { $statusCol = 19 }
    elseif ($statusCol -eq 0) { $statusCol = [Math]::Min(19, $lastCol) }

    if ($solutionCol -eq 0 -and $lastCol -ge 20) { $solutionCol = 20 }

    Write-Log "Cot Xac nhan trang thai: Cot $statusCol | Cot Noi dung xu ly: Cot $solutionCol"

    for ($r = 2; $r -le $lastRow; $r++) {
        $idStr = $ws.Cells.Item($r, 1).Text.Trim()
        if ([string]::IsNullOrWhiteSpace($idStr)) { continue }
        
        $id = 0
        if (-not [int]::TryParse($idStr, [ref]$id)) { continue }

        $timeStr     = $ws.Cells.Item($r, 3).Text.Trim()  # Thoi gian hoan thanh
        $email       = $ws.Cells.Item($r, 4).Text.Trim()
        $ten         = $ws.Cells.Item($r, 5).Text.Trim()
        $hinhThuc    = $ws.Cells.Item($r, 6).Text.Trim()
        $msnv        = $ws.Cells.Item($r, 7).Text.Trim()
        $section     = $ws.Cells.Item($r, 8).Text.Trim()
        $line        = $ws.Cells.Item($r, 9).Text.Trim()
        $leader      = $ws.Cells.Item($r, 10).Text.Trim()
        $loai        = $ws.Cells.Item($r, 11).Text.Trim()
        $tonDong     = $ws.Cells.Item($r, 12).Text.Trim()
        $giaiPhap    = $ws.Cells.Item($r, 13).Text.Trim()
        $khoKhan     = $ws.Cells.Item($r, 14).Text.Trim()
        $mongMuon    = $ws.Cells.Item($r, 15).Text.Trim()
        $thoiGianSuVu= $ws.Cells.Item($r, 16).Text.Trim()
        $doiTuong    = $ws.Cells.Item($r, 17).Text.Trim()
        $mongMuon1   = $ws.Cells.Item($r, 18).Text.Trim()

        # Doc trang thai xu ly tu cot 'Xac nhan trang thai'
        $statusVal   = if ($statusCol -gt 0) { $ws.Cells.Item($r, $statusCol).Text.Trim() } else { "" }
        $isResolved  = ($statusVal -match "^(ok|done|da xong|đã xong|hoan thanh|hoàn thành)$")

        # Doc noi dung xu ly tu cot T ('Noi dung xu li')
        $solutionVal = if ($solutionCol -gt 0) { $ws.Cells.Item($r, $solutionCol).Text.Trim() } else { "" }
        if ([string]::IsNullOrWhiteSpace($solutionVal) -and $lastCol -ge 20) {
            $solutionVal = $ws.Cells.Item($r, 20).Text.Trim()
        }

        # Parse thoi gian
        $parsedDate = Get-Date
        if (-not [DateTime]::TryParse($timeStr, [ref]$parsedDate)) {
            $parsedDate = Get-Date
        }

        # Xac dinh thong tin nguoi gui (An danh hay co thong tin)
        $isAnonymous = ($hinhThuc -match "ẩn danh|an danh" -or $email -ieq "anonymous" -or [string]::IsNullOrWhiteSpace($ten))
        $senderDisplay = ""
        if ($isAnonymous) {
            $senderDisplay = "🕵️ ẨN DANH"
        } else {
            $senderDisplay = "🧑 $ten"
            if (-not [string]::IsNullOrWhiteSpace($msnv)) {
                $senderDisplay += " (MSNV: $msnv)"
            }
        }

        # Tong hop noi dung phan anh
        $contentParts = @()
        if (-not [string]::IsNullOrWhiteSpace($khoKhan))  { $contentParts += $khoKhan }
        if (-not [string]::IsNullOrWhiteSpace($tonDong))  { $contentParts += $tonDong }
        if (-not [string]::IsNullOrWhiteSpace($thoiGianSuVu)) { $contentParts += "Thời gian/Địa điểm: $thoiGianSuVu" }
        if (-not [string]::IsNullOrWhiteSpace($doiTuong)) { $contentParts += "Hành vi/Đối tượng: $doiTuong" }
        $mainContent = $contentParts -join "`n"

        # Tong hop mong muon / de xuat
        $wishParts = @()
        if (-not [string]::IsNullOrWhiteSpace($mongMuon))  { $wishParts += $mongMuon }
        if (-not [string]::IsNullOrWhiteSpace($giaiPhap))  { $wishParts += $giaiPhap }
        if (-not [string]::IsNullOrWhiteSpace($mongMuon1)) { $wishParts += $mongMuon1 }
        $wishContent = $wishParts -join "`n"

        $records += [PSCustomObject]@{
            Id            = $id
            Date          = $parsedDate
            DateStr       = $parsedDate.ToString("HH:mm - dd/MM/yyyy")
            DayOnly       = $parsedDate.ToString("yyyy-MM-dd")
            IsAnonymous   = $isAnonymous
            Sender        = $senderDisplay
            Section       = if ([string]::IsNullOrWhiteSpace($section)) { "KHU VỰC CHUNG" } else { $section.ToUpper().Trim() }
            Line          = $line
            LeaderStatus  = Clean-OptionText $leader
            Category      = Clean-OptionText $loai
            Content       = $mainContent
            Wish          = $wishContent
            StatusVal     = $statusVal
            IsResolved    = $isResolved
            SolutionVal   = $solutionVal
        }
    }
} catch {
    Write-Log "Loi khi doc file Excel: $_" "ERROR"
    exit 1
} finally {
    if ($wb) { try { $wb.Close($false) } catch {} }
    if ($excel) {
        try {
            $excel.Quit()
            [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
        } catch {}
    }
}

# Xu ly gui tin nhan
$tracking = Get-TrackingData
$sentIds = @()
if ($tracking.sent_ids) {
    $sentIds = @($tracking.sent_ids)
}

# PHAN LOAI THEO TRANG THAI XAC NHAN (OK VS CHUA OK)
$resolvedRecords   = @($records | Where-Object { $_.IsResolved } | Sort-Object Id)
$unresolvedRecords = @($records | Where-Object { -not $_.IsResolved } | Sort-Object Id)

Write-Log "Tong hop: $($records.Count) phan anh | Da xu ly OK: $($resolvedRecords.Count) | Chua xac nhan OK: $($unresolvedRecords.Count)"

foreach ($res in $resolvedRecords) {
    Write-Log "Phan anh ID #$($res.Id) da duoc xac nhan OK ('$($res.StatusVal)') -> Khong can gui bao cao nua."
}

# 1. TACH PHAN ANH CHUA XAC NHAN (CHUA OK):
# Nhom 1A: Phan anh moi tinh chua tung gui Zalo lan nao
$newUnsentRecords = @($unresolvedRecords | Where-Object { -not ($sentIds -contains [int]$_.Id) } | Sort-Object Id)

# Nhom 1B: Phan anh ton dong da tung gui truoc do nhung chua duoc nhap OK
$pendingReminderRecords = @($unresolvedRecords | Where-Object { $sentIds -contains [int]$_.Id } | Sort-Object Id)

$todayStr = (Get-Date).ToString("yyyy-MM-dd")
$lastReminderDate = if ($tracking.last_reminder_date) { $tracking.last_reminder_date } else { "" }

# A. GUI CAC PHAN ANH MOI TINH (Chua tung gui)
if ($newUnsentRecords.Count -gt 0) {
    Write-Log "Phat hien $($newUnsentRecords.Count) phan anh moi tinh chua tung gui vao Zalo."
    foreach ($rec in $newUnsentRecords) {
        $locStr = "📍 $($rec.Section)"
        if (-not [string]::IsNullOrWhiteSpace($rec.Line)) {
            $locStr += " (Vị trí: $($rec.Line))"
        }

        $leaderStr = if (-not [string]::IsNullOrWhiteSpace($rec.LeaderStatus)) { $rec.LeaderStatus } else { "Chưa ghi nhận" }
        $catStr    = if (-not [string]::IsNullOrWhiteSpace($rec.Category)) { $rec.Category } else { "Góp ý hiện trường" }

        $msg  = "📢 [TIẾNG NÓI HIỆN TRƯỜNG] - PHẢN ÁNH MỚI #$($rec.Id)`n"
        $msg += "⏰ Thời gian: $($rec.DateStr)`n"
        $msg += "---------------------------------------------`n"
        $msg += "👤 Người phản ánh: $($rec.Sender)`n"
        $msg += "🏭 Khu vực: $locStr`n"
        $msg += "📋 Phân loại: ⚠️ $catStr`n"
        $msg += "🔄 Trao đổi Leader: ⏳ $leaderStr`n`n"
        
        $msg += "📝 NỘI DUNG PHẢN ÁNH:`n"
        $msg += "`"$($rec.Content)`"`n`n"
        
        if (-not [string]::IsNullOrWhiteSpace($rec.Wish)) {
            $msg += "💡 NGUYỆN VỌNG / ĐỀ XUẤT:`n"
            $msg += "`"$($rec.Wish)`"`n"
        }
        
        $msg += "---------------------------------------------`n"
        $msg += "👉 Đề nghị Quản lý bộ phận $($rec.Section) & Bộ phận liên quan kiểm tra và có hướng xử lý phản hồi cho người lao động."

        Write-Log "Dang gui phan anh moi ID #$($rec.Id) vao nhom Zalo '$ZALO_GROUP_NAME'..."
        $sentOk = Send-ZaloMessageVoice -text $msg
        
        if ($sentOk -and -not $TestOnly) {
            $sentIds += [int]$rec.Id
            Set-TrackingProperty $tracking "sent_ids" @($sentIds | Select-Object -Unique)
            Set-TrackingProperty $tracking "last_run" ((Get-Date).ToString("yyyy-MM-dd HH:mm:ss"))
            Save-TrackingData $tracking
            Write-Log "Da gui thanh cong va luu tracking cho ID #$($rec.Id)"
        }
        
        Start-Sleep -Seconds 2
    }
}

# B. GUI NHAC NHO HANG NGAY CHO CAC PHAN ANH CHUA XAC NHAN "OK"
# Chay khi: ManualTrigger (nguoi dung bam chu dong) HOAC luc 8h hang ngay neu hom nay chua gui nhac nho
$shouldSendDailyReminder = ($Action -ne "WeeklySummary") -and ($ManualTrigger -or ($lastReminderDate -ne $todayStr))

if ($pendingReminderRecords.Count -gt 0) {
    if ($shouldSendDailyReminder) {
        Write-Log "Co $($pendingReminderRecords.Count) phan anh chua xac nhan OK can nhac nho hang ngay vao Zalo."
        foreach ($rec in $pendingReminderRecords) {
            $locStr = "📍 $($rec.Section)"
            if (-not [string]::IsNullOrWhiteSpace($rec.Line)) {
                $locStr += " (Vị trí: $($rec.Line))"
            }

            $leaderStr = if (-not [string]::IsNullOrWhiteSpace($rec.LeaderStatus)) { $rec.LeaderStatus } else { "Chưa ghi nhận" }
            $catStr    = if (-not [string]::IsNullOrWhiteSpace($rec.Category)) { $rec.Category } else { "Góp ý hiện trường" }

            $daysPending = [Math]::Max(1, [int]((Get-Date).Date - $rec.Date.Date).TotalDays)

            $msg  = "📢 [TIẾNG NÓI HIỆN TRƯỜNG] - NHẮC NHỞ CHƯA XỬ LÝ (TỒN ĐỌNG $daysPending NGÀY) #$($rec.Id)`n"
            $msg += "⏰ Thời gian tiếp nhận: $($rec.DateStr)`n"
            $msg += "---------------------------------------------`n"
            $msg += "👤 Người phản ánh: $($rec.Sender)`n"
            $msg += "🏭 Khu vực: $locStr`n"
            $msg += "📋 Phân loại: ⚠️ $catStr`n"
            $msg += "🔄 Trao đổi Leader: ⏳ $leaderStr`n`n"
            
            $msg += "📝 NỘI DUNG PHẢN ÁNH:`n"
            $msg += "`"$($rec.Content)`"`n`n"
            
            if (-not [string]::IsNullOrWhiteSpace($rec.Wish)) {
                $msg += "💡 NGUYỆN VỌNG / ĐỀ XUẤT:`n"
                $msg += "`"$($rec.Wish)`"`n"
            }
            
            $msg += "---------------------------------------------`n"
            $msg += "⚠️ Phản ánh chưa được xác nhận hoàn tất. Đề nghị Quản lý bộ phận $($rec.Section) đôn đốc xử lý. (Nhập 'OK' vào file Excel để kết thúc nhắc nhở)."

            Write-Log "Dang gui tin nhac nho ton dong ID #$($rec.Id) vao nhom Zalo '$ZALO_GROUP_NAME'..."
            $sentOk = Send-ZaloMessageVoice -text $msg
            if ($sentOk -or $TestOnly) {
                Write-Log "Da gui thanh cong tin nhan nhac nho cho ID #$($rec.Id)"
            }
            Start-Sleep -Seconds 2
        }

            if (-not $TestOnly) {
                Set-TrackingProperty $tracking "last_reminder_date" $todayStr
                Set-TrackingProperty $tracking "last_run" ((Get-Date).ToString("yyyy-MM-dd HH:mm:ss"))
                Save-TrackingData $tracking
            }
        } else {
            Write-Log "Cac phan anh ton dong da duoc nhac nho trong ngay hom nay ($todayStr). Khong gui lap lai."
        }
} else {
    Write-Log "Khong co phan anh nao dang ton dong chua xu ly."
    if ($ManualTrigger -and $newUnsentRecords.Count -eq 0 -and $Action -ne "WeeklySummary") {
        Write-Log "Tat ca phan anh trong file Excel deu da duoc xac nhan OK (hoan tat)."
        $doneMsg  = "📢 [TIẾNG NÓI HIỆN TRƯỜNG] - THÔNG BÁO TIẾN ĐỘ`n`n"
        $doneMsg += "✅ Hiện tại tất cả các ý kiến phản ánh từ hiện trường đều đã được xử lý và xác nhận OK!`n"
        $doneMsg += "👏 Cảm ơn các bộ phận đã tích cực tiếp thu và giải quyết phản ánh cho người lao động."
        Send-ZaloMessageVoice -text $doneMsg | Out-Null
    }
}

# 2. TONG KET CUOI TUAN (Vao Thu 7 hoac khi Action la 'WeeklySummary')
$currentDayOfWeek = (Get-Date).DayOfWeek
$isWeekend = ($currentDayOfWeek -eq [System.DayOfWeek]::Saturday)
$cal = [System.Globalization.DateTimeFormatInfo]::CurrentInfo.Calendar
$currentWeekNum = $cal.GetWeekOfYear((Get-Date), [System.Globalization.CalendarWeekRule]::FirstDay, [System.DayOfWeek]::Monday)
$weekCode = "$((Get-Date).Year)-W$currentWeekNum"

if ($Action -eq "WeeklySummary" -or ($isWeekend -and $tracking.last_weekly_summary_week -ne $weekCode)) {
    Write-Log "Bat dau tao bao cao TONG KET TUAN ($weekCode)..."
    
    $now = Get-Date
    $firstDayOfMonth = [DateTime]::new($now.Year, $now.Month, 1)
    $monthYearStr = $now.ToString("MM/yyyy")
    $periodStr = "Từ 01/$($now.ToString('MM')) đến $($now.ToString('dd/MM/yyyy'))"

    # Lay cac phan anh tu dau thang den hien tai (bao gom ca cac phan anh ton dong chua xong tu truoc neu co)
    $summaryRecords = @($records | Where-Object { $_.Date.Date -ge $firstDayOfMonth.Date -or (-not $_.IsResolved) } | Sort-Object Id)
    $totalSummary = $summaryRecords.Count

    if ($totalSummary -gt 0) {
        $resolvedSummary   = @($summaryRecords | Where-Object { $_.IsResolved })
        $unresolvedSummary = @($summaryRecords | Where-Object { -not $_.IsResolved })
        $percentResolved   = if ($totalSummary -gt 0) { [Math]::Round(($resolvedSummary.Count / $totalSummary) * 100, 0) } else { 0 }

        $weekMsg  = "📊 [TỔNG KẾT TUẦN] TIẾNG NÓI TỪ HIỆN TRƯỜNG SẢN XUẤT 🗣️`n"
        $weekMsg += "📅 Tuần $currentWeekNum - Tháng $monthYearStr ($periodStr)`n"
        $weekMsg += "🔢 Tổng số ý kiến tiếp nhận từ đầu tháng: $totalSummary phản ánh`n"
        $weekMsg += "=============================================`n`n"

        # Thong ke tien do xu ly
        $weekMsg += "📊 TỔNG HỢP TIẾN ĐỘ XỬ LÝ:`n"
        $weekMsg += "  • 🟢 Đã hoàn tất xử lý (OK): $($resolvedSummary.Count) ý kiến ($percentResolved%)`n"
        $weekMsg += "  • 🔴 Chưa hoàn tất: $($unresolvedSummary.Count) ý kiến`n`n"

        # Thong ke theo Section
        $weekMsg += "🏢 PHÂN BỔ THEO BỘ PHẬN (SECTION):`n"
        $bySection = $summaryRecords | Group-Object -Property Section
        foreach ($sec in $bySection) {
            $secResolved = @($sec.Group | Where-Object { $_.IsResolved }).Count
            $secUnresolved = @($sec.Group | Where-Object { -not $_.IsResolved }).Count
            $secNote = if ($secUnresolved -gt 0) { " [🔴 $secUnresolved chưa xong]" } else { " [🟢 100% OK]" }
            $weekMsg += "  • $($sec.Name): $($sec.Count) ý kiến$secNote`n"
        }
        $weekMsg += "`n"

        # Thong ke An danh vs Co ten
        $anonCount = @($summaryRecords | Where-Object { $_.IsAnonymous }).Count
        $publicCount = @($summaryRecords | Where-Object { -not $_.IsAnonymous }).Count
        $weekMsg += "👥 HÌNH THỨC GỬI: 🕵️ Ẩn danh: $anonCount  |  🧑 Có danh tính: $publicCount`n`n"

        # Danh sach phan anh CHUA XU LY (neu co)
        if ($unresolvedSummary.Count -gt 0) {
            $weekMsg += "⚠️ CÁC PHẢN ÁNH CHƯA XỬ LÝ (CẦN GIẢI QUYẾT GẤP):`n"
            $idxU = 1
            foreach ($item in $unresolvedSummary) {
                $shortContent = $item.Content
                if ($shortContent.Length -gt 220) { $shortContent = $shortContent.Substring(0, 217) + "..." }
                $shortContent = $shortContent -replace "`r?`n", " "

                $loc = if (-not [string]::IsNullOrWhiteSpace($item.Line)) { "$($item.Section) - $($item.Line)" } else { $item.Section }
                $weekMsg += "$idxU️⃣ #$($item.Id) [$loc] - Ngày $($item.Date.ToString('dd/MM')) [🔴 CHƯA OK]`n"
                $weekMsg += "   • Người gửi: $($item.Sender)`n"
                $weekMsg += "   • Nội dung: `"$shortContent`"`n"
                if (-not [string]::IsNullOrWhiteSpace($item.Wish)) {
                    $shortWish = $item.Wish -replace "`r?`n", " "
                    if ($shortWish.Length -gt 150) { $shortWish = $shortWish.Substring(0, 147) + "..." }
                    $weekMsg += "   • Nguyện vọng: `"$shortWish`"`n"
                }
                if (-not [string]::IsNullOrWhiteSpace($item.SolutionVal)) {
                    $weekMsg += "   • ⏳ Ghi chú xử lý: $($item.SolutionVal)`n"
                }
                $weekMsg += "`n"
                $idxU++
            }
        }

        # Danh sach phan anh DA XU LY XONG (OK) - Bao gom Cot T (Noi dung xu ly)
        if ($resolvedSummary.Count -gt 0) {
            $weekMsg += "✅ CÁC PHẢN ÁNH ĐÃ XỬ LÝ HOÀN TẤT (OK):`n"
            $idxR = 1
            foreach ($item in $resolvedSummary) {
                $shortContent = $item.Content
                if ($shortContent.Length -gt 220) { $shortContent = $shortContent.Substring(0, 217) + "..." }
                $shortContent = $shortContent -replace "`r?`n", " "

                $loc = if (-not [string]::IsNullOrWhiteSpace($item.Line)) { "$($item.Section) - $($item.Line)" } else { $item.Section }
                $weekMsg += "$idxR️⃣ #$($item.Id) [$loc] - Ngày $($item.Date.ToString('dd/MM')) [🟢 ĐÃ XỬ LÝ OK]`n"
                $weekMsg += "   • Người gửi: $($item.Sender)`n"
                $weekMsg += "   • Nội dung phản ánh: `"$shortContent`"`n"
                
                $solText = if (-not [string]::IsNullOrWhiteSpace($item.SolutionVal)) { 
                    $item.SolutionVal.Trim() -replace "`r?`n", " " 
                } else { 
                    "Đã xác nhận giải quyết hoàn tất" 
                }
                $weekMsg += "   • 🛠️ Nội dung xử lý: $solText`n`n"
                $idxR++
            }
        }

        $weekMsg += "=============================================`n"
        $weekMsg += "👉 Đề nghị Quản lý các Bộ phận tiếp tục theo dõi, tiếp thu và xử lý dứt điểm các ý kiến từ hiện trường!"

        Write-Log "Dang gui Bao cao Tong Ket Tuan vao nhom Zalo '$ZALO_GROUP_NAME'..."
        $sentWeekOk = Send-ZaloMessageVoice -text $weekMsg
        if ($sentWeekOk -and -not $TestOnly) {
            Set-TrackingProperty $tracking "last_weekly_summary_week" $weekCode
            Set-TrackingProperty $tracking "last_run" ((Get-Date).ToString("yyyy-MM-dd HH:mm:ss"))
            Save-TrackingData $tracking
            Write-Log "Da gui thanh cong Bao cao Tong Ket Tuan ($weekCode)!"
        }
    } else {
        Write-Log "Tu dau thang den nay khong co phan anh nao phat sinh. Bo qua tong ket tuan."
    }
}

Write-Log "=== HOAN TAT TIEN TRINH EMPLOYEES VOICE ==="
