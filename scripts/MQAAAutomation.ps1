# scripts/MQAAAutomation.ps1
# Script tự động gửi báo cáo MQAA vào Zalo mỗi sáng 08:00
# Logic: Báo cáo hàng ngày cho ngày hôm trước + Tổng kết tuần vào Thứ 7

# === Cấu hình (Người dùng thay đổi tại đây) ===
$SUPABASE_URL = "https://doyipagavbxupiwbitgi.supabase.co"
$SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRveWlwYWdhdmJ4dXBpd2JpdGdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMTc0NzUsImV4cCI6MjA3NDc5MzQ3NX0.hRCtL5wOxFXFPAR_r0vyYsL044d0caT-EZqx-p9kva0"
$ZALO_GROUP_NAME = "My Documents" # Nhập tên chính xác của nhóm Zalo

# === Khởi tạo thư viện ===
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Các nhãn tiếng Việt (Dùng [char] để tránh lỗi encoding)
$L_HEADER = "*B" + [char]0x00C1 + "O C" + [char]0x00C1 + "O VI PH" + [char]0x1EA0 + "M MQAA*" 
$L_DATE = "Ng" + [char]0x00E0 + "y:"                                        
$L_SECTION = "B" + [char]0x1ED9 + " ph" + [char]0x1EAD + "n:"             
$L_SHIFT = "Ca:"                                                          
$L_LINE = "Line:"                                                         
$L_LEADER = "Leader:"                                                     
$L_WORKER = "Ng" + [char]0x01B0 + [char]0x1EDD + "i vi ph" + [char]0x1EA1 + "m:" 
$L_ISSUE_TYPE = "Lo" + [char]0x1EA1 + "i vi ph" + [char]0x1EA1 + "m:"       
$L_DESCRIPTION = "M" + [char]0x00F4 + " t" + [char]0x1EA3 + ":"             
$L_WEEKLY_TITLE = [char]0xD83D + [char]0xDCC8 + " *T" + [char]0x1ED4 + "NG K" + [char]0x1EBE + "T VI PH" + [char]0x1EA0 + "M MQAA TRONG TU" + [char]0x1EA6 + "N*"
$L_TOTAL_ERRORS = "T" + [char]0x1ED5 + "ng s" + [char]0x1ED1 + " l" + [char]0x1ED7 + "i ghi nh" + [char]0x1EAD + "n:"
$L_STATS_SECTION = "Th" + [char]0x1ED1 + "ng k" + [char]0x00EA + " theo B" + [char]0x1ED9 + " ph" + [char]0x1EAD + "n:"
$L_TOP_LINES = "Top 3 Line vi ph" + [char]0x1EA1 + "m nhi" + [char]0x1EC1 + "u nh" + [char]0x1EA5 + "t:"
$L_SEP = "-----------------------"
$L_DASHBOARD = [char]0xD83D + [char]0xDCCA + " *Xem Dashboard MQAA t" + [char]0x1EA1 + "i " + [char]0x0111 + [char]0x00E2 + "y:*" 
$DASHBOARD_LINK = "https://kpi-app-ckg6.vercel.app/mqaa-dashboard"

# Emojis
$E_ANNOUNCE = [char]0xD83D + [char]0xDCE2                                  
$E_CALENDAR = [char]0xD83D + [char]0xDDD3                                  
$E_SECTION = [char]0xD83D + [char]0xDCC1                                   
$E_CLOCK = [char]0x23F0                                                   
$E_LOCATION = [char]0xD83D + [char]0xDCCD                                  
$E_OFFICER = [char]0xD83D + [char]0xDC6E                                  
$E_USER = [char]0xD83D + [char]0xDC64                                     
$E_WARNING = [char]0x26A0 + [char]0xFE0F                                  
$E_NOTE = [char]0xD83D + [char]0xDCDD                                     
$E_CHART = [char]0xD83D + [char]0xDCC8                                    
$E_BLUE_DOT = [char]0xD83D + [char]0xDD39                                 
$E_FIRE = [char]0xD83D + [char]0xDD25                                     
$E_NUM1 = "1" + [char]0x20E3; $E_NUM2 = "2" + [char]0x20E3; $E_NUM3 = "3" + [char]0x20E3

function Send-ZaloMessage {
    param([string]$text)
    [System.Windows.Forms.Clipboard]::SetText($text, [System.Windows.Forms.TextDataFormat]::UnicodeText)
    [System.Windows.Forms.SendKeys]::SendWait("^v")
    Start-Sleep -Milliseconds 500
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Start-Sleep -Milliseconds 500
}

function Send-ZaloImageGroup {
    param([string[]]$imageUrls)
    if ($imageUrls.Count -eq 0) { return }
    $tempFolder = Join-Path $env:TEMP ("mqaa_group_" + (Get-Date -Format "yyyyMMdd_HHmmss") + "_" + (Get-Random))
    $null = New-Item -ItemType Directory -Path $tempFolder -Force
    $filePaths = New-Object System.Collections.Specialized.StringCollection
    try {
        foreach ($url in $imageUrls) {
            $fileName = [System.IO.Path]::GetFileName(([uri]$url).AbsolutePath)
            if (-not $fileName) { $fileName = "image_$(Get-Random).jpg" }
            $localPath = Join-Path $tempFolder $fileName
            Invoke-WebRequest -Uri $url -OutFile $localPath -UserAgent "Mozilla/5.0"
            if (Test-Path $localPath) { [void]$filePaths.Add($localPath) }
        }
        [System.Windows.Forms.Clipboard]::SetFileDropList($filePaths)
        [System.Windows.Forms.SendKeys]::SendWait("^v")
        Start-Sleep -Milliseconds 3000
        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
        Start-Sleep -Seconds 3
    }
    finally { if (Test-Path $tempFolder) { Remove-Item -Path $tempFolder -Recurse -Force -ErrorAction SilentlyContinue } }
}

try {
    $todayStr = Get-Date -Format "yyyy-MM-dd"
    $currentTime = Get-Date -Format "HH:mm"
    $headers = @{ "apikey" = $SUPABASE_KEY; "Authorization" = "Bearer $SUPABASE_KEY" }

    # 1. Lấy cấu hình hệ thống
    $settingsUrl = "$SUPABASE_URL/rest/v1/mqaa_settings?id=eq.1"
    $settings = Invoke-RestMethod -Uri $settingsUrl -Headers $headers -Method Get
    
    if ($settings) {
        $ZALO_GROUP_NAME = if ($settings[0].zalo_group) { $settings[0].zalo_group } else { $ZALO_GROUP_NAME }
        $REPORT_TIME = if ($settings[0].report_time) { $settings[0].report_time } else { "08:00" }
        $PATROL_ZALO_GROUP = if ($settings[0].patrol_zalo_group) { $settings[0].patrol_zalo_group } else { $ZALO_GROUP_NAME }
        $PATROL_REPORT_TIME = if ($settings[0].patrol_report_time) { $settings[0].patrol_report_time } else { $REPORT_TIME }
        $LAST_RUN = $settings[0].last_run_date

        # Kích hoạt Zalo
        $zaloProcess = Get-Process -Name Zalo -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle } | Select-Object -First 1
        if (-not $zaloProcess) { throw "Hãy mở Zalo PC trước." }
        Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);' -Name "Win32" -Namespace "Util" -ErrorAction SilentlyContinue
        [Util.Win32]::SetForegroundWindow($zaloProcess.MainWindowHandle)
        Start-Sleep -Seconds 2

        # ============================================
        # PHẦN A: BÁO CÁO VI PHẠM MQAA HÀNG NGÀY
        # ============================================
        if ($currentTime -ge $REPORT_TIME -and $LAST_RUN -ne $todayStr) {
            $yesterday = (Get-Date).AddDays(-1).ToString("yyyy-MM-dd")
            $response = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/mqaa_logs?date=eq.$yesterday&select=*" -Headers $headers -Method Get
            
            if ($response.Count -gt 0) {
                Write-Host ">>> Gửi báo cáo vi phạm ngày $yesterday..." -ForegroundColor Cyan
                # Tìm nhóm Zalo
                [System.Windows.Forms.SendKeys]::SendWait("^f")
                Start-Sleep -Milliseconds 800
                [System.Windows.Forms.Clipboard]::SetText($ZALO_GROUP_NAME, [System.Windows.Forms.TextDataFormat]::UnicodeText)
                [System.Windows.Forms.SendKeys]::SendWait("^v")
                Start-Sleep -Seconds 1
                [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
                Start-Sleep -Seconds 1

                foreach ($log in $response) {
                    $msg = "$E_ANNOUNCE $L_HEADER`n$L_SEP`n$E_CALENDAR $L_DATE $($log.date)`n$E_SECTION $L_SECTION $($log.section)`n$E_CLOCK $L_SHIFT $($log.shift)`n$E_LOCATION $L_LINE $($log.line)`n$E_OFFICER $L_LEADER $($log.leader_name)`n"
                    if ($log.worker_name) { $msg += "$E_USER $L_WORKER $($log.worker_name) ($($log.worker_id))`n" }
                    $msg += "$E_WARNING $L_ISSUE_TYPE $($log.issue_type)`n$E_NOTE $L_DESCRIPTION $($log.description)`n$L_SEP"
                    Send-ZaloMessage -text $msg
                    if ($log.image_url) { Send-ZaloImageGroup -imageUrls @($log.image_url) }
                }

                # Cập nhật trạng thái
                $null = Invoke-RestMethod -Uri $settingsUrl -Headers $headers -Method Patch -Body '{"last_run_date":"'$todayStr'"}' -ContentType "application/json"
            }
        }

        # ============================================
        # PHẦN B: BÁO CÁO PATROL MQAA
        # ============================================
        if ($currentTime -ge $PATROL_REPORT_TIME) {
            $yesterdayDate = (Get-Date).AddDays(-1).Date
            $yesterdayStr = $yesterdayDate.ToString("yyyy-MM-dd")
            $lastSentDate = $settings[0].last_patrol_report_monday

            if ($lastSentDate -ne $yesterdayStr) {
                Write-Host ">>> Kiểm tra báo cáo Patrol ngày $yesterdayStr..." -ForegroundColor Cyan
                $patrolUrl = "$SUPABASE_URL/rest/v1/mqaa_patrol_logs?date=eq.$yesterdayStr&select=auditor_name,auditor_id,date,section,overall_performance,evaluation_data"
                $patrolData = Invoke-RestMethod -Uri $patrolUrl -Headers $headers -Method Get
            
                if ($patrolData -and $patrolData.Count -gt 0) {
                    $allSections = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/mqaa_patrol_sections?select=name&order=sort_order.asc" -Headers $headers -Method Get

                    # Chuyển sang nhóm Zalo Patrol
                    [System.Windows.Forms.SendKeys]::SendWait("^f")
                    Start-Sleep -Milliseconds 800
                    [System.Windows.Forms.Clipboard]::SetText($PATROL_ZALO_GROUP, [System.Windows.Forms.TextDataFormat]::UnicodeText)
                    [System.Windows.Forms.SendKeys]::SendWait("^v")
                    Start-Sleep -Seconds 1
                    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
                    Start-Sleep -Seconds 1

                    $titlePatrol = [char]0xD83D + [char]0xDCCB + " *PHI" + [char]0x1EBE + "U T" + [char]0x1ED4 + "NG K" + [char]0x1EBE + "T MQAA*"
                    $subTitleDaily = "*(Ng" + [char]0x00E0 + "y: " + $yesterdayDate.ToString("dd/MM/yyyy") + ")*"

                    # 1. Gửi phiếu riêng lẻ
                    $auditorGroups = $patrolData | Group-Object auditor_id
                    foreach ($auditorGroup in $auditorGroups) {
                        $auditorName = $auditorGroup.Group[0].auditor_name
                        $evidenceItems = @()
                        $patrolMsg = "$titlePatrol`n$E_USER *Auditor: $auditorName - Ngày: $($yesterdayDate.ToString("dd/MM"))*`n$subTitleDaily`n$L_SEP`n"
                        $totalSum = 0; $count = 0
                        $secGroups = $auditorGroup.Group | Group-Object { $_.section.Replace("_", " ") }
                        foreach ($sg in $secGroups) {
                            $score = [Math]::Round(($sg.Group | Measure-Object overall_performance -Average).Average, 1)
                            $patrolMsg += "$E_BLUE_DOT **$($sg.Name)**: $score%`n"
                            $totalSum += $score; $count++
                            if ($score -lt 100) {
                                foreach ($rec in $sg.Group) {
                                    if ($rec.evaluation_data) {
                                        foreach ($item in $rec.evaluation_data) {
                                            $isHeader = if ($item.is_header -ne $null) { $item.is_header } else { $item.isHeader }
                                            if (-not $isHeader -and [double]$item.level -lt [double]$item.score) {
                                                $desc = if ($item.description) { $item.description } else { $item.label }
                                                $evidenceItems += [PSCustomObject]@{ Section = $sg.Name; Text = $desc; Image = $item.image_url }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        $patrolMsg += "$L_SEP`n$starEmoji **Performance: " + ([Math]::Round($totalSum/$count, 1)) + "%**"
                        if ($evidenceItems.Count -gt 0) {
                            $patrolMsg += "`n`n$E_WARNING *CHI TI" + [char]0x1EBE + "T C" + [char]0x00C1 + "C L" + [char]0x1ED6 + "I:*`n"
                            $imgs = @()
                            foreach ($ev in $evidenceItems) {
                                $patrolMsg += "- **$($ev.Section)**: $($ev.Text)`n"
                                if ($ev.Image) { $imgs += $ev.Image }
                            }
                            Send-ZaloMessage -text $patrolMsg
                            if ($imgs.Count -gt 0) { Send-ZaloImageGroup -imageUrls ($imgs | Select-Object -Unique) }
                        } else { Send-ZaloMessage -text $patrolMsg }
                    }

                    # 2. Bảng tổng kết ngày
                    $sumMsg = "$titlePatrol`n*T" + [char]0x1ED4 + "NG K" + [char]0x1EBE + "T B" + [char]0x1ED8 + " PH" + [char]0x1EAC + "N TRONG NG" + [char]0x00C0 + "Y*`n$subTitleDaily`n$L_SEP`n"
                    $oSum = 0; $oCount = 0
                    $dStats = $patrolData | Group-Object { $_.section.Replace("_", " ") }
                    foreach ($sec in $allSections) {
                        $match = $dStats | Where-Object { $_.Name -eq $sec.name }
                        if ($match) {
                            $score = [Math]::Round(($match.Group | Measure-Object overall_performance -Average).Average, 1)
                            $sumMsg += "$E_BLUE_DOT **$($sec.name)**: $score%`n"
                            $oSum += $score; $oCount++
                        } else { $sumMsg += "$E_BLUE_DOT **$($sec.name)**: ...`n" }
                    }
                    $sumMsg += "$L_SEP`n$starEmoji **Overall Daily Performance: " + ([Math]::Round($oSum/$oCount, 1)) + "%**"
                    Send-ZaloMessage -text $sumMsg

                    # 3. Tổng kết tuần (Chỉ Thứ 7)
                    if ((Get-Date).DayOfWeek -eq [System.DayOfWeek]::Saturday) {
                        $monDate = (Get-Date).AddDays( - (([int](Get-Date).DayOfWeek - 1 + 7) % 7)).Date
                        $wUrl = "$SUPABASE_URL/rest/v1/mqaa_patrol_logs?date=gte.$($monDate.ToString("yyyy-MM-dd"))&date=lte.$todayStr&select=overall_performance,section"
                        $wData = Invoke-RestMethod -Uri $wUrl -Headers $headers -Method Get
                        if ($wData) {
                            $wMsg = "$titlePatrol`n*T" + [char]0x1ED4 + "NG K" + [char]0x1EBE + "T VI PH" + [char]0x1EA0 + "M MQAA TRONG TU" + [char]0x1EA6 + "N*`n*(Tu" + [char]0x1EA7 + "n t" + [char]0x1EEB + " " + $monDate.ToString("dd/MM") + " " + [char]0x0111 + [char]0x1EBF + "n " + (Get-Date).ToString("dd/MM") + ")*`n$L_SEP`n"
                            $wStats = $wData | Group-Object { $_.section.Replace("_", " ") }
                            $ws = 0; $wc = 0
                            foreach ($sec in $allSections) {
                                $m = $wStats | Where-Object { $_.Name -eq $sec.name }
                                if ($m) {
                                    $score = [Math]::Round(($m.Group | Measure-Object overall_performance -Average).Average, 1)
                                    $wMsg += "$E_BLUE_DOT **$($sec.name)**: $score%`n"
                                    $ws += $score; $wc++
                                } else { $wMsg += "$E_BLUE_DOT **$($sec.name)**: ...`n" }
                            }
                            $wMsg += "$L_SEP`n$starEmoji **Weekly Overall: " + ([Math]::Round($ws/$wc, 1)) + "%**"
                            Send-ZaloMessage -text $wMsg
                        }
                    }

                    # Cập nhật trạng thái
                    $null = Invoke-RestMethod -Uri $settingsUrl -Headers $headers -Method Patch -Body ('{"last_patrol_report_monday":"' + $yesterdayStr + '"}') -ContentType "application/json"
                }
            }
        }
    }
} catch { Write-Error "Loi: $_" }
