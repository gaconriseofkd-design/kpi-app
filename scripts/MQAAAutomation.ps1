# scripts/MQAAAutomation.ps1
# Script tự động gửi báo cáo MQAA vào Zalo mỗi sáng 08:00

# === Cấu hình (Người dùng thay đổi tại đây) ===
$SUPABASE_URL = "https://doyipagavbxupiwbitgi.supabase.co"
$SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRveWlwYWdhdmJ4dXBpd2JpdGdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMTc0NzUsImV4cCI6MjA3NDc5MzQ3NX0.hRCtL5wOxFXFPAR_r0vyYsL044d0caT-EZqx-p9kva0"
$ZALO_GROUP_NAME = "MQAA TESTING REPORT" # Nhập tên chính xác của nhóm Zalo

# === Khởi tạo thư viện ===
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Các nhãn tiếng Việt (Dùng [char] để tránh lỗi encoding và overflow)
$L_HEADER = "*B" + [char]0x00C1 + "O C" + [char]0x00C1 + "O VI PH" + [char]0x1EA0 + "M MQAA*" # *BÁO CÁO VI PHẠM MQAA*
$L_DATE = "Ng" + [char]0x00E0 + "y:"                                        # Ngày:
$L_SECTION = "B" + [char]0x1ED9 + " ph" + [char]0x1EAD + "n:"             # Bộ phận:
$L_SHIFT = "Ca:"                                                          # Ca:
$L_LINE = "Line:"                                                         # Line:
$L_LEADER = "Leader:"                                                     # Leader:
$L_WORKER = "Ng" + [char]0x01B0 + [char]0x1EDD + "i vi ph" + [char]0x1EA1 + "m:" # Người vi phạm:
$L_ISSUE_TYPE = "Lo" + [char]0x1EA1 + "i vi ph" + [char]0x1EA1 + "m:"       # Loại vi phạm:
$L_DESCRIPTION = "M" + [char]0x00F4 + " t" + [char]0x1EA3 + ":"             # Mô tả:
$L_WEEKLY_TITLE = [char]0xD83D + [char]0xDCC8 + " *T" + [char]0x1ED4 + "NG K" + [char]0x1EBF + "T VI PH" + [char]0x1EA0 + "M MQAA TRONG TU" + [char]0x1EA7 + "N*"
$L_TOTAL_ERRORS = "T" + [char]0x1ED5 + "ng s" + [char]0x1ED1 + " l" + [char]0x1ED7 + "i ghi nh" + [char]0x1EAD + "n:"
$L_STATS_SECTION = "Th" + [char]0x1ED1 + "ng k" + [char]0x00EA + " theo B" + [char]0x1ED9 + " ph" + [char]0x1EAD + "n:"
$L_TOP_LINES = "Top 3 Line vi ph" + [char]0x1EA1 + "m nhi" + [char]0x1EC1 + "u nh" + [char]0x1EA5 + "t:"
$L_SEP = "-----------------------"
$L_DASHBOARD = [char]0xD83D + [char]0xDCCA + " *Xem Dashboard MQAA t" + [char]0x1EA1 + "i " + [char]0x0111 + [char]0x00E2 + "y:*" # 📊 *Xem Dashboard MQAA tại đây:*
$DASHBOARD_LINK = "https://kpi-app-ckg6.vercel.app/mqaa-dashboard"

# Emojis (Surrogate pairs for wide characters)
$E_ANNOUNCE = [char]0xD83D + [char]0xDCE2                                  # 📢
$E_CALENDAR = [char]0xD83D + [char]0xDDD3                                  # 🗓
$E_SECTION = [char]0xD83D + [char]0xDCC1                                   # 📂
$E_CLOCK = [char]0x23F0                                                   # ⏰
$E_LOCATION = [char]0xD83D + [char]0xDCCD                                  # 📍
$E_OFFICER = [char]0xD83D + [char]0xDC6E                                  # 👮
$E_USER = [char]0xD83D + [char]0xDC64                                     # 👤
$E_WARNING = [char]0x26A0 + [char]0xFE0F                                  # ⚠️
$E_NOTE = [char]0xD83D + [char]0xDCDD                                     # 📝
$E_CHART = [char]0xD83D + [char]0xDCC8                                    # 📊
$E_BLUE_DOT = [char]0xD83D + [char]0xDD39                                 # 🔹
$E_FIRE = [char]0xD83D + [char]0xDD25                                     # 🔥
$E_NUM1 = "1" + [char]0x20E3
$E_NUM2 = "2" + [char]0x20E3
$E_NUM3 = "3" + [char]0x20E3

function Send-ZaloMessage {
    param([string]$text)
    # Use .NET Clipboard for better Unicode handling in PowerShell 5.1
    [System.Windows.Forms.Clipboard]::SetText($text, [System.Windows.Forms.TextDataFormat]::UnicodeText)
    [System.Windows.Forms.SendKeys]::SendWait("^v")
    Start-Sleep -Milliseconds 500
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Start-Sleep -Milliseconds 500
}

function Send-ZaloImageGroup {
    param([string[]]$imageUrls)
    if ($imageUrls.Count -eq 0) { return }
    
    Write-Host ">>> Đang chuẩn bị gửi $($imageUrls.Count) ảnh..." -ForegroundColor Cyan
    
    $tempFolder = Join-Path $env:TEMP ("mqaa_group_" + (Get-Date -Format "yyyyMMdd_HHmmss") + "_" + (Get-Random))
    $null = New-Item -ItemType Directory -Path $tempFolder -Force
    
    $filePaths = New-Object System.Collections.Specialized.StringCollection
    
    try {
        foreach ($url in $imageUrls) {
            Write-Host "--- Tải ảnh: $url"
            $fileName = [System.IO.Path]::GetFileName(([uri]$url).AbsolutePath)
            if (-not $fileName) { $fileName = "image_$(Get-Random).jpg" }
            $localPath = Join-Path $tempFolder $fileName
            
            Invoke-WebRequest -Uri $url -OutFile $localPath -UserAgent "Mozilla/5.0"
            if (Test-Path $localPath) {
                $size = (Get-Item $localPath).Length
                Write-Host "--- Tải thành công ($size bytes): $fileName"
                [void]$filePaths.Add($localPath)
            }
        }
        
        # Set clipboard as FileDropList (this allows Zalo to group them)
        [System.Windows.Forms.Clipboard]::SetFileDropList($filePaths)
        
        Write-Host ">>> Đang dán ảnh vào Zalo (Clipboard -> Ctrl+V)..." -ForegroundColor Cyan
        [System.Windows.Forms.SendKeys]::SendWait("^v")
        Start-Sleep -Milliseconds 3000 # Wait for Zalo to process group (tăng thêm thời gian)
        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
        Start-Sleep -Seconds 3
        Write-Host ">>> Đã gửi nhóm ảnh xong." -ForegroundColor Green
    }
    catch {
        Write-Warning "Lỗi khi gom nhóm ảnh: $($_.Exception.Message)"
    }
    finally {
        # Cleanup
        if (Test-Path $tempFolder) {
            Remove-Item -Path $tempFolder -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

# === Bắt đầu thực hiện ===
try {
    # 0. Thiết lập ngày tháng
    $yesterday = (Get-Date).AddDays(-1).ToString("yyyy-MM-dd")
    $todayStr = Get-Date -Format "yyyy-MM-dd"
    $currentTime = Get-Date -Format "HH:mm"

    Write-Host "-------------------------------------------"
    Write-Host "Đang lấy dữ liệu MQAA cho ngày: $yesterday"

    # Thiết lập headers Supabase
    $headers = @{
        "apikey"        = $SUPABASE_KEY
        "Authorization" = "Bearer $SUPABASE_KEY"
    }

    # 1. Lấy cấu hình hệ thống
    $settingsUrl = "$SUPABASE_URL/rest/v1/mqaa_settings?id=eq.1"
    $IMAGE_LIMIT = 10
    # $ZALO_GROUP_NAME được giữ từ cấu hình ở trên (dòng 7) làm mặc định
    $REPORT_TIME = "08:00"
    $LAST_RUN = ""

    try {
        $settings = Invoke-RestMethod -Uri $settingsUrl -Headers $headers -Method Get
        if ($settings) {
            $ZALO_GROUP_NAME = if ($settings[0].zalo_group) { $settings[0].zalo_group } else { $ZALO_GROUP_NAME }
            $IMAGE_LIMIT = if ($settings[0].image_limit -gt 0) { [int]$settings[0].image_limit } else { 10 }
            $REPORT_TIME = if ($settings[0].report_time) { $settings[0].report_time } else { "08:00" }
            $LAST_RUN = $settings[0].last_run_date
            
            Write-Host "Giờ hiện tại: $currentTime | Giờ báo cáo: $REPORT_TIME"
            Write-Host "Ngày chạy cuối: $LAST_RUN | Ngày hôm nay: $todayStr"

            # KIỂM TRA ĐIỀU KIỆN CHẠY BÁO CÁO CHI TIẾT
            if ($LAST_RUN -eq $todayStr) {
                Write-Host "Báo cáo ngày hôm nay đã được gửi trước đó. Kết thúc."
                return
            }
            if ($currentTime -lt $REPORT_TIME) {
                Write-Host "Chưa đến giờ báo cáo ($REPORT_TIME). Kết thúc."
                return
            }
            Write-Host "Bắt đầu xử lý báo cáo..."
        }
    }
    catch {
        Write-Warning "Không thể lấy cấu hình chi tiết, dùng mặc định."
    }

    # 2. Truy vấn dữ liệu vi phạm
    $url = "$SUPABASE_URL/rest/v1/mqaa_logs?date=eq.$yesterday&select=*"
    Write-Host "URL: $url"
    
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
    if ($response.Count -eq 0) {
        Write-Host "Không có vi phạm nào trong ngày $yesterday."
        # Cập nhật ngày chạy để không kiểm tra lại
        $updateBody = '{"last_run_date":"' + $todayStr + '"}'
        $null = Invoke-RestMethod -Uri $settingsUrl -Headers $headers -Method Patch -Body $updateBody -ContentType "application/json"
        return
    }

    Write-Host "Tìm thấy $($response.Count) bản ghi. Bắt đầu gửi Zalo..."

    # 3. Kích hoạt Zalo
    $zaloProcess = Get-Process -Name Zalo -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle } | Select-Object -First 1
    if (-not $zaloProcess) {
        Write-Error "Không tìm thấy Zalo PC. Vui lòng mở Zalo trước."
        return
    }

    $signature = @"
[DllImport("user32.dll")]
public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
[DllImport("user32.dll")]
[return: MarshalAs(UnmanagedType.Bool)]
public static extern bool SetForegroundWindow(IntPtr hWnd);
[DllImport("user32.dll")]
public static extern bool IsIconic(IntPtr hWnd);
"@
    $type = Add-Type -MemberDefinition $signature -Name "Win32Utils" -Namespace "Win32" -PassThru -ErrorAction SilentlyContinue
    $hWnd = $zaloProcess.MainWindowHandle
    if ([Win32.Win32Utils]::IsIconic($hWnd)) {
        [Win32.Win32Utils]::ShowWindow($hWnd, 9)
        Start-Sleep -Milliseconds 500
    }
    [Win32.Win32Utils]::SetForegroundWindow($hWnd)
    Start-Sleep -Seconds 2

    # Tìm nhóm Zalo
    [System.Windows.Forms.SendKeys]::SendWait("^f")
    Start-Sleep -Milliseconds 800
    [System.Windows.Forms.Clipboard]::SetText($ZALO_GROUP_NAME, [System.Windows.Forms.TextDataFormat]::UnicodeText)
    [System.Windows.Forms.SendKeys]::SendWait("^v")
    Start-Sleep -Seconds 1
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Start-Sleep -Seconds 1

    # 4. Gửi từng bản ghi
    foreach ($log in $response) {
        $msg = $E_ANNOUNCE + " " + $L_HEADER + "`n" +
        $L_SEP + "`n" +
        $E_CALENDAR + " " + $L_DATE + " " + $log.date + "`n" +
        $E_SECTION + " " + $L_SECTION + " " + $log.section + "`n" +
        $E_CLOCK + " " + $L_SHIFT + " " + $log.shift + "`n" +
        $E_LOCATION + " " + $L_LINE + " " + $log.line + "`n" +
        $E_OFFICER + " " + $L_LEADER + " " + $log.leader_name + "`n"

        if ($log.worker_name) {
            $msg += $E_USER + " " + $L_WORKER + " " + $log.worker_name + " (" + $log.worker_id + ")`n"
        }

        $msg += $E_WARNING + " " + $L_ISSUE_TYPE + " " + $log.issue_type + "`n" +
        $E_NOTE + " " + $L_DESCRIPTION + " " + $log.description + "`n" +
        $L_SEP

        Send-ZaloMessage -text $msg

        if ($log.image_url) {
            $urls = @()
            if ($log.image_url -is [array]) { $urls = $log.image_url }
            elseif ($log.image_url -is [string] -and $log.image_url -ne "") { $urls = @($log.image_url) }
            
            if ($urls.Count -gt 0) {
                if ($IMAGE_LIMIT -gt 0 -and $urls.Count -gt $IMAGE_LIMIT) {
                    $urls = $urls[0..($IMAGE_LIMIT - 1)]
                }
                Send-ZaloImageGroup -imageUrls $urls
            }
        }
    }

    # 5. Báo cáo tổng kết tuần
    Write-Host ">>> Đã gửi xong tất cả báo cáo chi tiết. Đợi 2 giây trước khi gửi tổng kết tuần..."
    Start-Sleep -Seconds 2
    Write-Host "-------------------------------------------"
    Write-Host "Đang tạo báo cáo tổng kết tuần..."
    $mondayDate = (Get-Date).AddDays( - (([int](Get-Date).DayOfWeek - 1 + 7) % 7)).Date
    $mondayStr = $mondayDate.ToString("yyyy-MM-dd")
    $weeklyUrl = "$SUPABASE_URL/rest/v1/mqaa_logs?date=gte.$mondayStr&date=lte.$yesterday&select=*"
    
    $weeklyData = Invoke-RestMethod -Uri $weeklyUrl -Headers $headers -Method Get
    if ($weeklyData.Count -gt 0) {
        $totalCount = $weeklyData.Count
        $sectionStats = $weeklyData | Group-Object section | Select-Object Name, Count | Sort-Object Count -Descending
        $topLines = $weeklyData | Group-Object line | ForEach-Object {
            [PSCustomObject]@{
                Line    = $_.Name
                Count   = $_.Count
                Section = $_.Group[0].section
            }
        } | Sort-Object Count -Descending | Select-Object -First 3
        
        $summaryMsg = $E_CHART + " " + $L_WEEKLY_TITLE + "`n" +
        "*(T" + [char]0x1EEB + " Th" + [char]0x1EE9 + " 2, " + $mondayDate.ToString("dd/MM") + " " + [char]0x0111 + [char]0x1EBF + "n " + (Get-Date).ToString("dd/MM") + ")*`n" +
        $L_SEP + "`n" +
        $E_CHART + " " + $L_TOTAL_ERRORS + " **$totalCount** " + "l" + [char]0x1ED7 + "i`n`n" +
        $E_LOCATION + " " + $L_STATS_SECTION + "`n"

        foreach ($stat in $sectionStats) {
            $percent = [Math]::Round(($stat.Count / $totalCount) * 100, 1)
            $summaryMsg += $E_BLUE_DOT + " **" + $stat.Name + "**: " + $stat.Count + " l" + [char]0x1ED7 + "i ($percent%)`n"
        }
        
        $summaryMsg += "`n" + $E_FIRE + " " + $L_TOP_LINES + "`n"
        $rankEmojis = @($E_NUM1, $E_NUM2, $E_NUM3)
        for ($i = 0; $i -lt $topLines.Count; $i++) {
            $lineInfo = $topLines[$i]
            $summaryMsg += $rankEmojis[$i] + " **Line " + $lineInfo.Line + "** (" + $lineInfo.Section + "): " + $lineInfo.Count + " l" + [char]0x1ED7 + "i`n"
        }
        $summaryMsg += $L_SEP + "`n" +
        $L_DASHBOARD + "`n" +
        $DASHBOARD_LINK
        Send-ZaloMessage -text $summaryMsg
        Write-Host "Đã gửi báo cáo tổng kết tuần."
    }

    # 6. Cập nhật ngày chạy cuối
    $updateBody = '{"last_run_date":"' + $todayStr + '"}'
    $null = Invoke-RestMethod -Uri $settingsUrl -Headers $headers -Method Patch -Body $updateBody -ContentType "application/json"
    Write-Host "Hoàn thành gửi báo cáo!"

}
catch {
    Write-Error "Lỗi thực thi: $($_.Exception.Message)"
}
