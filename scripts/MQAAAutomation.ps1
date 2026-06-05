# scripts/MQAAAutomation.ps1
# Script tự động gửi báo cáo MQAA vào Zalo mỗi sáng 08:00
# Logic: Báo cáo hàng ngày cho ngày hôm trước + Tổng kết tuần vào Thứ 7

param(
    [switch]$ManualTrigger,
    [string]$TargetReport = ""
)

# === Cấu hình (Người dùng thay đổi tại đây) ===
$SUPABASE_URL = "https://doyipagavbxupiwbitgi.supabase.co"
$SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRveWlwYWdhdmJ4dXBpd2JpdGdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMTc0NzUsImV4cCI6MjA3NDc5MzQ3NX0.hRCtL5wOxFXFPAR_r0vyYsL044d0caT-EZqx-p9kva0"
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

# === Win32 API: ShowWindow + SetForegroundWindow ===
$win32Src = @"
using System;
using System.Runtime.InteropServices;
public class WinHelper {
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmd);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
    // nCmd: 6 = SW_MINIMIZE, 9 = SW_RESTORE
}
"@
Add-Type -TypeDefinition $win32Src -Language CSharp -ErrorAction SilentlyContinue

# Handle của Zalo và cửa sổ terminal hiện tại (set trong main)
$script:zaloHandle   = [IntPtr]::Zero
$script:myHandle     = [IntPtr]::Zero

# Hàm focus Zalo trước khi gửi phím
function Focus-Zalo {
    if ($script:myHandle -ne [IntPtr]::Zero) {
        [WinHelper]::ShowWindow($script:myHandle, 6) | Out-Null   # Minimize terminal
    }
    
    $zaloThread = [WinHelper]::GetWindowThreadProcessId($script:zaloHandle, [ref]0)
    $myThread = [WinHelper]::GetCurrentThreadId()
    $fgWindow = [WinHelper]::GetForegroundWindow()
    $fgThread = [WinHelper]::GetWindowThreadProcessId($fgWindow, [ref]0)
    
    if ($fgThread -ne $zaloThread) {
        [WinHelper]::AttachThreadInput($myThread, $zaloThread, $true) | Out-Null
        [WinHelper]::AttachThreadInput($fgThread, $zaloThread, $true) | Out-Null
    }
    
    [WinHelper]::ShowWindow($script:zaloHandle, 9) | Out-Null   # Restore
    Start-Sleep -Milliseconds 300
    [WinHelper]::SetForegroundWindow($script:zaloHandle) | Out-Null
    
    if ($fgThread -ne $zaloThread) {
        [WinHelper]::AttachThreadInput($myThread, $zaloThread, $false) | Out-Null
        [WinHelper]::AttachThreadInput($fgThread, $zaloThread, $false) | Out-Null
    }
    Start-Sleep -Milliseconds 500
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
    Focus-Zalo
    [System.Windows.Forms.Clipboard]::SetText($text, [System.Windows.Forms.TextDataFormat]::UnicodeText)
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
        Focus-Zalo
        [System.Windows.Forms.Clipboard]::SetFileDropList($filePaths)
        Start-Sleep -Milliseconds 200
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
        $zaloProcess = Get-Process -Name Zalo -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle } | Select-Object -First 1
        if (-not $zaloProcess) {
            Write-Log "LOI: Zalo PC chua mo." "ERROR"
            throw "Hay mo Zalo PC truoc khi chay script!"
        }
        Write-Log "Zalo dang mo: PID=$($zaloProcess.Id) | Title='$($zaloProcess.MainWindowTitle)'"

        # Lưu handle
        $script:zaloHandle = $zaloProcess.MainWindowHandle
        $script:myHandle   = (Get-Process -Id $PID).MainWindowHandle

        # Minimize terminal + focus Zalo
        Write-Log "Minimize terminal, focus Zalo..."
        Focus-Zalo
        Start-Sleep -Seconds 2

        $sysSettings = $null
        try {
            $sysData = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/system_settings?id=eq.1" -Headers $headers -Method Get
            if ($sysData) { $sysSettings = $sysData[0] }
        } catch {}

        $isMqaaEnabled = $sysSettings.is_mqaa_patrol_enabled -ne $false
        $isWipEnabled = $sysSettings.is_wip_enabled -ne $false

        $runPatrol = ($TargetReport -eq "mqaa_patrol") -or (-not $ManualTrigger -and $isMqaaEnabled -and $currentTime -ge $PATROL_REPORT_TIME)
        $runWip = ($TargetReport -eq "wip_report") -or (-not $ManualTrigger -and $isWipEnabled -and (Get-Date).Hour -eq 8)

        # ============================================
        # PHẦN B: BÁO CÁO PATROL MQAA
        # ============================================
        if ($runPatrol) {
            $yesterdayDate = (Get-Date).AddDays(-1).Date
            $yesterdayStr  = $yesterdayDate.ToString("yyyy-MM-dd")
            $lastSentDate  = $settings[0].last_patrol_report_monday
            Write-Log "Kiem tra Patrol: HomQua=$yesterdayStr | DaGui=$lastSentDate"

            if ($lastSentDate -ne $yesterdayStr) {
                Write-Log ">>> Bat dau gui bao cao Patrol ngay $yesterdayStr..."
                $patrolUrl  = "$SUPABASE_URL/rest/v1/mqaa_patrol_logs?date=eq.$yesterdayStr&select=auditor_name,auditor_id,date,section,overall_performance,evaluation_data"
                $patrolData = Invoke-RestMethod -Uri $patrolUrl -Headers $headers -Method Get

                if ($patrolData -and $patrolData.Count -gt 0) {
                    $allSections = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/mqaa_patrol_sections?select=name&order=sort_order.asc" -Headers $headers -Method Get

                    # Chuyển sang nhóm Zalo Patrol (Focus trước khi gửi phím)
                    Focus-Zalo
                    [System.Windows.Forms.SendKeys]::SendWait("^f")
                    Start-Sleep -Milliseconds 800
                    [System.Windows.Forms.Clipboard]::SetText($PATROL_ZALO_GROUP, [System.Windows.Forms.TextDataFormat]::UnicodeText)
                    [System.Windows.Forms.SendKeys]::SendWait("^v")
                    Start-Sleep -Seconds 2
                    [System.Windows.Forms.SendKeys]::SendWait("{DOWN}")
                    Start-Sleep -Milliseconds 500
                    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Start-Sleep -Seconds 3
                    Write-Log "Da chuyen sang nhom Zalo: $PATROL_ZALO_GROUP"

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
                                            if (-not $isHeader -and [double]$item.level -lt [double]$item.score) {
                                                $desc = if ($item.description) { $item.description } else { $item.label }
                                                $evidenceItems += [PSCustomObject]@{ Section = $sg.Name; Text = $desc; Image = $item.image_url }
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
        $WIP_EXCEL_PATH = "C:\Users\prod.public\Ortholite Vietnam\OVN Production - Documents\PRODUCTION\Nhân Lg\Schedule\Ovn Pro Schedule.xlsb"
        if (Test-Path $WIP_EXCEL_PATH) {
            $excelWIP = New-Object -ComObject Excel.Application
            $excelWIP.Visible = $false
            $excelWIP.DisplayAlerts = $false
            try {
                $wbWIP = $excelWIP.Workbooks.Open($WIP_EXCEL_PATH, 0, $true)
                $shWIP = $wbWIP.Sheets.Item("Record Wip")
                
                $lastRow = $shWIP.Cells.Item($shWIP.Rows.Count, 1).End(-4162).Row; if ($lastRow -lt 1) { $lastRow = 1 }
                
                $colNames = @($shWIP.Cells.Item(1,2).Text.Trim(), $shWIP.Cells.Item(1,3).Text.Trim(), $shWIP.Cells.Item(1,4).Text.Trim(), $shWIP.Cells.Item(1,5).Text.Trim(), $shWIP.Cells.Item(1,6).Text.Trim(), $shWIP.Cells.Item(1,7).Text.Trim(), $shWIP.Cells.Item(1,8).Text.Trim())
                
                $wipValues = @()
                for ($c = 2; $c -le 8; $c++) {
                    $valText = $shWIP.Cells.Item($lastRow, $c).Text
                    $valNum = 0
                    if (-not [string]::IsNullOrWhiteSpace($valText)) {
                        $valText = $valText -replace '[^\d\.-]', ''
                        if ($valText) { [double]::TryParse($valText, [ref]$valNum) | Out-Null }
                    }
                    $wipValues += $valNum
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
                
                Write-Log "Da tao xong bao cao WIP."
                
                $WIP_TARGET = "Daily Report"
                # Chuyển Zalo Target
                Focus-Zalo
                [System.Windows.Forms.SendKeys]::SendWait("^f")
                Start-Sleep -Milliseconds 800
                [System.Windows.Forms.Clipboard]::SetText($WIP_TARGET, [System.Windows.Forms.TextDataFormat]::UnicodeText)
                [System.Windows.Forms.SendKeys]::SendWait("^v")
                Start-Sleep -Seconds 2
                [System.Windows.Forms.SendKeys]::SendWait("{DOWN}")
                Start-Sleep -Milliseconds 500
                [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Start-Sleep -Seconds 3
                
                Send-ZaloMessage -text $wipMsg
                Write-Log "Da gui bao cao WIP vao $WIP_TARGET."
                
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
