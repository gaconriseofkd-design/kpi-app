# scripts/ReportWatcher.ps1
# Script này chạy ẩn qua 1 file bat duy nhất (Report Watcher Auto-Start) để quản lý & tự động gửi tất cả các báo cáo Zalo.

$SUPABASE_URL = "https://ewhfhputqeyebffjwtnl.supabase.co"
$SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3aGZocHV0cWV5ZWJmZmp3dG5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyOTU1OTMsImV4cCI6MjEwNDg3MTU5M30.a368bZeQDr2du8R4ipKHpMZm0ITJlIqeD6wqba-fbRM"

$headers = @{
    "apikey"        = $SUPABASE_KEY
    "Authorization" = "Bearer $SUPABASE_KEY"
    "Content-Type"  = "application/json"
}

# Lấy đường dẫn thư mục hiện tại để gọi script con
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Definition
$storeIntakeScript = Join-Path $scriptPath "StoreIntakeReport.ps1"
$mqaaScript        = Join-Path $scriptPath "MQAAAutomation.ps1"
$otScript          = Join-Path $scriptPath "Send_OT_Pivot_Report.ps1"
$voiceScript       = Join-Path $scriptPath "Send_Employees_Voice.ps1"

function Ensure-AllScriptsBom {
    try {
        $psFiles = Get-ChildItem -Path (Join-Path $scriptPath "*.ps1")
        $utf8BOM = New-Object System.Text.UTF8Encoding $true
        foreach ($file in $psFiles) {
            $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
            if ($bytes.Length -lt 3 -or $bytes[0] -ne 239 -or $bytes[1] -ne 187 -or $bytes[2] -ne 191) {
                $text = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
                [System.IO.File]::WriteAllText($file.FullName, $text, $utf8BOM)
                Write-Host "Auto-fixed UTF-8 BOM: $($file.Name)" -ForegroundColor Cyan
            }
        }
    } catch {}
}

Ensure-AllScriptsBom

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ">>> REPORT WATCHER AUTO-START DANG CHAY CHUNG DUY NHAT <<<" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

$script:lastAutoOTReport = ""
$script:lastAutoOTRefresh = ""
$script:lastAutoVoiceReport = ""
$script:lastTrackingListExport = (Get-Date).AddHours(-24) # Kich hoat ngay lap tuc o lan dau tien, sau do theo chu ky
$script:trackingProc = $null
$script:isTrackingRunning = $false
$script:trackingStartTime = $null

# Bien theo doi tinh trang dong bo du lieu TrackingList & Realtime de bao cao Zalo
$script:lastScheduledSyncReportSlot = ""
$script:lastSyncAnomalyAlertTime = [DateTime]::MinValue
$script:isSyncCurrentlyAbnormal = $false
$script:zaloDailyReportGroup = "Daily Report"
$script:lastMorningGreetingDate = ""

while ($true) {
    try {
        # 1. Tìm các yêu cầu gửi báo cáo đang 'pending' từ Web App
        $requestUrl = "$SUPABASE_URL/rest/v1/report_requests?status=eq.pending&select=*"
        $pendingRequests = Invoke-RestMethod -Uri $requestUrl -Headers $headers -Method Get

        if ($pendingRequests -and $pendingRequests.Count -gt 0) {
            foreach ($req in $pendingRequests) {
                Write-Host "------------------------------------------------" -ForegroundColor Yellow
                Write-Host "Phat hien yeu cau moi: ID = $($req.id), Type = $($req.report_type)" -ForegroundColor Green
                
                # 2. Đổi trạng thái sang 'processing' để tránh trùng lặp
                $updateProcessingUrl = "$SUPABASE_URL/rest/v1/report_requests?id=eq.$($req.id)"
                $bodyProcessing = "{`"status`":`"processing`"}"
                Invoke-RestMethod -Uri $updateProcessingUrl -Headers $headers -Method Patch -Body $bodyProcessing | Out-Null
                
                # 3. Kích hoạt báo cáo tương ứng
                $reportType = $req.report_type
                Ensure-AllScriptsBom
                
                if ($reportType -eq "mqaa_patrol") {
                    Write-Host "Dang thuc thi MQAAAutomation.ps1..."
                    & powershell.exe -File $mqaaScript -ManualTrigger -TargetReport $reportType
                } elseif ($reportType -eq "ot_report" -or $reportType -eq "%ot" -or $reportType -eq "ot") {
                    Write-Host "Dang thuc thi Send_OT_Pivot_Report.ps1..."
                    & powershell.exe -File $otScript
                } elseif ($reportType -eq "employees_voice" -or $reportType -eq "voice") {
                    Write-Host "Dang thuc thi Send_Employees_Voice.ps1..."
                    & powershell.exe -ExecutionPolicy Bypass -File $voiceScript -ManualTrigger
                } else {
                    Write-Host "Dang thuc thi StoreIntakeReport.ps1 cho $reportType..."
                    & powershell.exe -File $storeIntakeScript -ManualTrigger -TargetReport $reportType
                }

                # 4. Đánh dấu hoàn thành
                $bodyCompleted = "{`"status`":`"completed`"}"
                Invoke-RestMethod -Uri $updateProcessingUrl -Headers $headers -Method Patch -Body $bodyCompleted | Out-Null
                
                Write-Host "Da xu ly xong yeu cau ID = $($req.id)" -ForegroundColor Green
                Write-Host "------------------------------------------------" -ForegroundColor Yellow
            }
        }
    }
    catch {
        Write-Host "Loi khi kiem tra Supabase: $_" -ForegroundColor Red
    }
    
    # 5. Kiem tra gui bao cao OT luc 14:00 (va Refresh luc 13:40)
    try {
        $currentHour = (Get-Date).Hour
        $currentMinute = (Get-Date).Minute
        $currentDate = (Get-Date).ToString("yyyy-MM-dd")
        
        # (Da bo tinh nang auto refresh luc 13:40 vi user da thiet lap tu dong tren file excel)
        # 5.2 Gui bao cao luc 14:00
        if ($currentHour -eq 14 -and $currentMinute -lt 5) {
            if ($script:lastAutoOTReport -ne $currentDate) {
                # Kiem tra xem nguoi dung co bat tu dong khong
                $sysData = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/system_settings?id=eq.1" -Headers $headers -Method Get
                $isOtEnabled = $false
                if ($sysData -and $sysData.Count -gt 0) {
                    if ($sysData[0].is_ot_report_enabled -eq $true) {
                        $isOtEnabled = $true
                    }
                }
                
                if ($isOtEnabled) {
                    Write-Host ">>> Kich hoat SEND bao cao OT tu dong (14:00) <<<" -ForegroundColor Green
                    & powershell.exe -File $otScript -Action "Send"
                } else {
                    Write-Host ">>> Bao cao OT tu dong (14:00) dang bi TAT tren he thong <<<" -ForegroundColor Yellow
                }
                # Danh dau la da kiem tra/chay trong ngay hom nay
                $script:lastAutoOTReport = $currentDate
            }
        }
    } catch {
        Write-Host "Loi khi chay OT tu dong: $_" -ForegroundColor Red
    }

    # 6. Kiem tra gui bao cao Employees Voice luc 09:00 (hoac ngay khi bat lai neu chua gui trong ngay)
    try {
        $currentHour = (Get-Date).Hour
        $currentMinute = (Get-Date).Minute
        $currentDate = (Get-Date).ToString("yyyy-MM-dd")
        
        # Kiem tra neu tu 8h tro di va chua gui trong ngay hom nay
        if ($currentHour -ge 9 -and $script:lastAutoVoiceReport -ne $currentDate) {
            # Kiem tra xem nguoi dung co bat tu dong khong
            $sysData = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/system_settings?id=eq.1" -Headers $headers -Method Get
            $isVoiceEnabled = $true
            if ($sysData -and $sysData.Count -gt 0) {
                if ($sysData[0].is_employees_voice_enabled -eq $false) {
                    $isVoiceEnabled = $false
                }
            }

            if ($isVoiceEnabled) {
                Write-Host ">>> Kich hoat KIEM TRA & GUI bao cao Employees Voice (09:00) <<<" -ForegroundColor Green
                & powershell.exe -ExecutionPolicy Bypass -File $voiceScript -Action "AutoCheck"
            } else {
                Write-Host ">>> Bao cao Employees Voice tu dong dang bi TAT tren he thong <<<" -ForegroundColor Yellow
            }
            $script:lastAutoVoiceReport = $currentDate
        }
    } catch {
        Write-Host "Loi khi chay Employees Voice tu dong: $_" -ForegroundColor Red
    }
    
    # 7. Kiem tra va tu dong tai bao cao TrackingList Online dinh ky moi 5 phut
    try {
        $now = Get-Date

        # Doc so phut tu file cau hinh nhanh interval_minutes.txt (neu co) hoac mac dinh 15 phut
        $intervalConfigFile = "C:\Users\prod.public\Ortholite Vietnam\OVN Production - Documents\PRODUCTION\TRUONG OFFICE\PROJECT\TRACKING LIST ONLINE\interval_minutes.txt"
        $intervalMinutes = 15
        if (Test-Path $intervalConfigFile) {
            $cfgVal = (Get-Content -Path $intervalConfigFile -Raw -ErrorAction SilentlyContinue)
            if ($cfgVal) {
                $cfgVal = $cfgVal.Trim()
                if ($cfgVal -as [double] -and [double]$cfgVal -gt 0) {
                    $intervalMinutes = [double]$cfgVal
                }
            }
        }

        # Kiem tra neu tien trinh xuat dang chay thi theo doi de thong bao hoan thanh
        if ($script:isTrackingRunning) {
            if ($script:trackingProc -and $script:trackingProc.HasExited) {
                $script:isTrackingRunning = $false
                $dataFile = "C:\Users\prod.public\Ortholite Vietnam\OVN Production - Documents\PRODUCTION\TRUONG OFFICE\PROJECT\TRACKING LIST ONLINE\TrackingList_Data.xlsx"
                $realtimeFile = "C:\Users\prod.public\Ortholite Vietnam\OVN Production - Documents\PRODUCTION\TRUONG OFFICE\PROJECT\TRACKING LIST ONLINE\REALTIME DATA\Realtime_Data.xlsx"
                $durationSec = [Math]::Round(($now - $script:trackingStartTime).TotalSeconds, 0)
                Write-Host "[$($now.ToString('HH:mm:ss'))] [HOAN THANH CHU KY TAI] Xu ly trong: ${durationSec}s" -ForegroundColor Green
                if (Test-Path $dataFile) {
                    $f = Get-Item $dataFile
                    $fSizeMB = [Math]::Round($f.Length / 1MB, 2)
                    $fTime = $f.LastWriteTime.ToString("HH:mm:ss")
                    Write-Host "  -> [1/2] TrackingList   : $fSizeMB MB (Gio: $fTime)" -ForegroundColor Green
                }
                if (Test-Path $realtimeFile) {
                    $rf = Get-Item $realtimeFile
                    $rfSizeMB = [Math]::Round($rf.Length / 1MB, 2)
                    $rfTime = $rf.LastWriteTime.ToString("HH:mm:ss")
                    Write-Host "  -> [2/2] Tien do Realtime: $rfSizeMB MB (Gio: $rfTime)" -ForegroundColor Green
                }
                $nextRunTime = $now.AddMinutes($intervalMinutes).ToString("HH:mm:ss")
                Write-Host "[$($now.ToString('HH:mm:ss'))] >>> Lan tai tu dong tiep theo se vao luc: $nextRunTime (sau $intervalMinutes phut) <<<" -ForegroundColor Cyan
            }
        }

        $minutesSinceLast = ($now - $script:lastTrackingListExport).TotalMinutes

        # Chi chay khi da du so phut theo cau hinh
        if ($minutesSinceLast -ge $intervalMinutes) {
            $trackingBat = "C:\Users\prod.public\Ortholite Vietnam\OVN Production - Documents\PRODUCTION\TRUONG OFFICE\PROJECT\TRACKING LIST ONLINE\auto_export.bat"

            if (Test-Path $trackingBat) {
                # Kiem tra tranh xung dot: Neu tien trinh tai lan truoc chua xong thi khong bat chong
                $activeProcess = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
                    Where-Object { $_.CommandLine -like "*auto_export.bat*" }

                if (-not $activeProcess) {
                    Write-Host "[$($now.ToString('HH:mm:ss'))] >>> KICH HOAT TU DONG TAI TRACKING LIST ONLINE ($intervalMinutes phut/lan) <<<" -ForegroundColor Cyan
                    $script:lastTrackingListExport = $now
                    $script:trackingStartTime = $now

                    # Khoi chay tien trinh ngam (Hidden) de khong chan vong lap ReportWatcher va khong anh huong den Zalo Report
                    $script:trackingProc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c `"$trackingBat`"" -WindowStyle Hidden -PassThru
                    $script:isTrackingRunning = $true
                } else {
                    Write-Host "[$($now.ToString('HH:mm:ss'))] TrackingList lan truoc van dang chay, bo qua chu ky nay de tranh xung dot." -ForegroundColor Yellow
                }
            } else {
                Write-Host "[$($now.ToString('HH:mm:ss'))] Khong tim thay file: $trackingBat" -ForegroundColor Red
            }
        }
    } catch {
        Write-Host "Loi khi chay TrackingList tu dong: $_" -ForegroundColor Red
    }
    # 8. Kiem tra va tu dong bao cao tinh trang dong bo TrackingList & Realtime vao nhom Zalo Daily Report
    try {
        $now = Get-Date
        $todayStr = $now.ToString("yyyy-MM-dd")
        $currentHour = $now.Hour
        $currentMinute = $now.Minute

        $trackingFilePath = "C:\Users\prod.public\Ortholite Vietnam\OVN Production - Documents\PRODUCTION\TRUONG OFFICE\PROJECT\TRACKING LIST ONLINE\XEM TRACKING\TrackingList_Xem.xlsx"
        if (-not (Test-Path $trackingFilePath)) {
            $trackingFilePath = "C:\Users\prod.public\Ortholite Vietnam\OVN Production - Documents\PRODUCTION\TRUONG OFFICE\PROJECT\TRACKING LIST ONLINE\TrackingList_Data.xlsx"
        }
        $realtimeFilePath = "C:\Users\prod.public\Ortholite Vietnam\OVN Production - Documents\PRODUCTION\TRUONG OFFICE\PROJECT\TRACKING LIST ONLINE\REALTIME DATA\Realtime_Data.xlsx"

        # Tinh toan thoi gian cap nhat & dung luong file
        $trackingExists = Test-Path $trackingFilePath
        $trackingTime = $null
        $trackingAgeMin = 999999
        $trackingTimeStr = "Chưa có file"
        $trackingSizeBytes = 0
        $trackingSizeStr = "0 MB"
        $isTrackingSizeSmall = $false

        if ($trackingExists) {
            $tItem = Get-Item $trackingFilePath
            $trackingTime = $tItem.LastWriteTime
            $trackingAgeMin = ($now - $trackingTime).TotalMinutes
            $trackingTimeStr = $trackingTime.ToString("HH:mm:ss")
            $trackingSizeBytes = $tItem.Length
            $trackingSizeMB = [Math]::Round($trackingSizeBytes / 1MB, 2)
            $trackingSizeStr = "${trackingSizeMB} MB"
            # Tieu chuan: Tracking list phai > 1 MB (1048576 bytes)
            if ($trackingSizeBytes -lt 1MB) {
                $isTrackingSizeSmall = $true
                $trackingSizeKB = [Math]::Round($trackingSizeBytes / 1KB, 1)
                $trackingSizeStr = "${trackingSizeKB} KB"
            }
        }

        $realtimeExists = Test-Path $realtimeFilePath
        $realtimeTime = $null
        $realtimeAgeMin = 999999
        $realtimeTimeStr = "Chưa có file"
        $realtimeSizeBytes = 0
        $realtimeSizeStr = "0 KB"
        $isRealtimeSizeSmall = $false

        if ($realtimeExists) {
            $rItem = Get-Item $realtimeFilePath
            $realtimeTime = $rItem.LastWriteTime
            $realtimeAgeMin = ($now - $realtimeTime).TotalMinutes
            $realtimeTimeStr = $realtimeTime.ToString("HH:mm:ss")
            $realtimeSizeBytes = $rItem.Length
            $realtimeSizeKB = [Math]::Round($realtimeSizeBytes / 1KB, 1)
            $realtimeSizeStr = "${realtimeSizeKB} KB"
            # Tieu chuan: Realtime data phai > 20 KB (20480 bytes)
            if ($realtimeSizeBytes -lt 20KB) {
                $isRealtimeSizeSmall = $true
            }
        }

        # Dieu kien bat thuong: Khong co file, hoac qua 1h chua cap nhat, HOAC dung luong nho bat thuong
        $isTrackingAbnormal = (-not $trackingExists) -or ($trackingAgeMin -ge 60) -or $isTrackingSizeSmall
        $isRealtimeAbnormal = (-not $realtimeExists) -or ($realtimeAgeMin -ge 60) -or $isRealtimeSizeSmall
        $isAnyAbnormal = $isTrackingAbnormal -or $isRealtimeAbnormal

        $zaloSendScript = Join-Path $scriptPath "Zalo_Send_Text.ps1"

        # ----------------------------------------------------------------------
        # 8.1. BÁO CÁO ĐỊNH KỲ VÀO 5 MỐC GIỜ: 06:00, 09:30, 15:00, 18:00, 21:00
        # (Tu dong gui bu neu khoi dong bot sau khi moc gio do da qua trong ngay)
        # ----------------------------------------------------------------------
        $currentSlot = ""
        $slotLabel = ""

        # Kiem tra neu co file trigger yeu cau gui ngay lap tuc
        $manualTriggerFile = Join-Path $scriptPath "trigger_sync_report.flag"
        if (Test-Path $manualTriggerFile) {
            Remove-Item $manualTriggerFile -Force -ErrorAction SilentlyContinue
            $currentSlot = "manual_" + (Get-Date).Ticks
            $slotLabel = if ($currentHour -lt 9 -or ($currentHour -eq 9 -and $currentMinute -lt 30)) { "06:00" } elseif ($currentHour -lt 15) { "09:30" } elseif ($currentHour -lt 18) { "15:00" } elseif ($currentHour -lt 21) { "18:00" } else { "21:00" }
        } elseif ($currentHour -ge 21) {
            $currentSlot = $todayStr + "_21:00"
            $slotLabel = "21:00"
        } elseif ($currentHour -ge 18) {
            $currentSlot = $todayStr + "_18:00"
            $slotLabel = "18:00"
        } elseif ($currentHour -ge 15) {
            $currentSlot = $todayStr + "_15:00"
            $slotLabel = "15:00"
        } elseif ($currentHour -gt 9 -or ($currentHour -eq 9 -and $currentMinute -ge 30)) {
            $currentSlot = $todayStr + "_09:30"
            $slotLabel = "09:30"
        } elseif ($currentHour -ge 6) {
            $currentSlot = $todayStr + "_06:00"
            $slotLabel = "06:00"
        }

        if ($currentSlot -and ($script:lastScheduledSyncReportSlot -ne $currentSlot)) {
            Write-Host "[$($now.ToString('HH:mm:ss'))] >>> Gui bao cao dong bo dinh ky vao Zalo Daily Report ($slotLabel) <<<" -ForegroundColor Green

            $trackStatus = if (-not $trackingExists) {
                "BẤT THƯỜNG - Không tìm thấy file"
            } elseif ($isTrackingSizeSmall) {
                "BẤT THƯỜNG - Dung lượng quá nhỏ ($trackingSizeStr < 1 MB) - Gần nhất: $trackingTimeStr"
            } elseif ($trackingAgeMin -ge 60) {
                "BẤT THƯỜNG - Quá 1 giờ chưa cập nhật ($trackingSizeStr - Gần nhất: $trackingTimeStr)"
            } else {
                "Ổn định ($trackingSizeStr) - Thời gian update gần nhất: $trackingTimeStr"
            }

            $rtStatus = if (-not $realtimeExists) {
                "BẤT THƯỜNG - Không tìm thấy file"
            } elseif ($isRealtimeSizeSmall) {
                "BẤT THƯỜNG - Dung lượng quá nhỏ ($realtimeSizeStr < 20 KB) - Gần nhất: $realtimeTimeStr"
            } elseif ($realtimeAgeMin -ge 60) {
                "BẤT THƯỜNG - Quá 1 giờ chưa cập nhật ($realtimeSizeStr - Gần nhất: $realtimeTimeStr)"
            } else {
                "Ổn định ($realtimeSizeStr) - Thời gian update gần nhất: $realtimeTimeStr"
            }

            $periodicMsg = "[BÁO CÁO ĐỒNG BỘ DỮ LIỆU - $slotLabel]`n- Tracking list online: $trackStatus`n- Realtime data: $rtStatus"

            & powershell.exe -ExecutionPolicy Bypass -File $zaloSendScript -GroupName $script:zaloDailyReportGroup -Message $periodicMsg
            $script:lastScheduledSyncReportSlot = $currentSlot
        }

        # ----------------------------------------------------------------------
        # 8.2. CẢNH BÁO BẤT THƯỜNG (KHI QUÁ 1 GIỜ / 60 PHÚT CHƯA CẬP NHẬT HOẶC DUNG LƯỢNG NHỎ)
        # Khung giờ theo dõi: 05:30 -> 21:30 để tránh làm phiền đêm khuya
        # Chống spam: Cách nhau ít nhất 60 phút mỗi lần cảnh báo nhắc lại
        # ----------------------------------------------------------------------
        $isOperatingHours = ($currentHour -ge 6 -and $currentHour -le 21) -or ($currentHour -eq 5 -and $currentMinute -ge 30)

        if ($isOperatingHours -and $isAnyAbnormal) {
            $minSinceLastAlert = ($now - $script:lastSyncAnomalyAlertTime).TotalMinutes
            if ($minSinceLastAlert -ge 60) {
                Write-Host "[$($now.ToString('HH:mm:ss'))] >>> CANH BAO: Phat hien file qua 1h chua duoc cap nhat hoac dung luong bat thuong! Gui canh bao Zalo... <<<" -ForegroundColor Red

                $alertMsg = "🚨 [CẢNH BÁO BẤT THƯỜNG DỮ LIỆU OVN]`nPhát hiện sự cố cập nhật dữ liệu:`n"
                
                # Tracking line
                if (-not $trackingExists) {
                    $alertMsg += "- Tracking list online: BẤT THƯỜNG - Không tìm thấy file!`n"
                } elseif ($isTrackingSizeSmall) {
                    $alertMsg += "- Tracking list online: BẤT THƯỜNG - Dung lượng quá nhỏ ($trackingSizeStr / Tiêu chuẩn: > 1 MB) - Có thể bị thiếu dòng!`n"
                } elseif ($trackingAgeMin -ge 60) {
                    $tLate = [Math]::Round($trackingAgeMin)
                    $alertMsg += "- Tracking list online: BẤT THƯỜNG - Quá 1 giờ chưa cập nhật ($trackingTimeStr - Trễ $tLate phút)`n"
                } else {
                    $alertMsg += "- Tracking list online: Ổn định ($trackingSizeStr - Gần nhất: $trackingTimeStr)`n"
                }

                # Realtime line
                if (-not $realtimeExists) {
                    $alertMsg += "- Realtime data: BẤT THƯỜNG - Không tìm thấy file!`n"
                } elseif ($isRealtimeSizeSmall) {
                    $alertMsg += "- Realtime data: BẤT THƯỜNG - Dung lượng quá nhỏ ($realtimeSizeStr / Tiêu chuẩn: > 20 KB) - Có thể bị thiếu dữ liệu!`n"
                } elseif ($realtimeAgeMin -ge 60) {
                    $rLate = [Math]::Round($realtimeAgeMin)
                    $alertMsg += "- Realtime data: BẤT THƯỜNG - Quá 1 giờ chưa cập nhật ($realtimeTimeStr - Trễ $rLate phút)`n"
                } else {
                    $alertMsg += "- Realtime data: Ổn định ($realtimeSizeStr - Gần nhất: $realtimeTimeStr)`n"
                }

                $alertMsg += "👉 Đã chặn ghi đè file hỏng để bảo toàn dữ liệu cũ. Vui lòng kiểm tra lại trang web xuất dữ liệu OVN!"

                & powershell.exe -ExecutionPolicy Bypass -File $zaloSendScript -GroupName $script:zaloDailyReportGroup -Message $alertMsg
                $script:lastSyncAnomalyAlertTime = $now
                $script:isSyncCurrentlyAbnormal = $true
            }
        }

        # ----------------------------------------------------------------------
        # 8.3. THÔNG BÁO HỒI PHỤC KHI ĐÃ CẬP NHẬT ỔN ĐỊNH TRỞ LẠI
        # ----------------------------------------------------------------------
        if (-not $isAnyAbnormal -and $script:isSyncCurrentlyAbnormal) {
            Write-Host "[$($now.ToString('HH:mm:ss'))] >>> He thong da dong bo on dinh tro lai. Gui thong bao hoi phuc Zalo... <<<" -ForegroundColor Green
            $recoveryMsg = "✅ [HỆ THỐNG ĐÃ ỔN ĐỊNH TRỞ LẠI]`nDữ liệu OVN đã được cập nhật thành công với dung lượng chuẩn:`n- Tracking list online: Ổn định ($trackingSizeStr - Cập nhật lúc $trackingTimeStr)`n- Realtime data: Ổn định ($realtimeSizeStr - Cập nhật lúc $realtimeTimeStr)"
            & powershell.exe -ExecutionPolicy Bypass -File $zaloSendScript -GroupName $script:zaloDailyReportGroup -Message $recoveryMsg
            $script:isSyncCurrentlyAbnormal = $false
            $script:lastSyncAnomalyAlertTime = [DateTime]::MinValue
        }
    } catch {
        Write-Host "Loi khi kiem tra bao cao Zalo Daily Report: $_" -ForegroundColor Red
    }

    # 9. Gui loi chao buoi sang & loi chuc ngay moi vao nhom Daily Report luc 07:00
    try {
        $now = Get-Date
        $currentHour = $now.Hour
        $todayStr = $now.ToString("yyyy-MM-dd")
        $dayOfWeek = $now.DayOfWeek # Sunday, Monday, ..., Saturday

        # Kiem tra file flag neu muon test gui loi chao ngay lap tuc
        $testGreetingFlag = Join-Path $scriptPath "trigger_greeting.flag"
        $isManualGreeting = Test-Path $testGreetingFlag
        if ($isManualGreeting) {
            Remove-Item $testGreetingFlag -Force -ErrorAction SilentlyContinue
        }

        # Khung gio chao buoi sang: tu 07:00 den truoc 09:00, moi ngay gui 1 lan duy nhat (hoac khi co flag manual)
        if ($isManualGreeting -or ($currentHour -ge 7 -and $currentHour -lt 9 -and $script:lastMorningGreetingDate -ne $todayStr)) {
            $zaloSendScript = Join-Path $scriptPath "Zalo_Send_Text.ps1"
            
            # Cac mau tin nhan sinh dong, am ap, thay doi ngau nhien de khong bi lap lai
            $greetingMsg = ""
            if ($dayOfWeek -eq [DayOfWeek]::Saturday) {
                # Thu 7 - Cuoi tuan
                $satGreetings = @(
                    "🌸 Chào buổi sáng thứ 7 cả nhà! Chúc mọi người có một ngày làm việc thật nhẹ nhàng, thuận lợi và có kỳ nghỉ cuối tuần thật vui vẻ, ấm áp bên gia đình! ☕🎉",
                    "☀️ Good morning thứ 7! Chúc anh chị em một ngày làm việc cuối tuần tràn đầy năng lượng, hoàn thành xuất sắc công việc để bước vào kỳ nghỉ cuối tuần thật thư giãn nhé! 🌿✨",
                    "🌻 Chúc cả nhà thứ 7 nhiều niềm vui! Chúc mọi người một ngày làm việc suôn sẻ, an toàn và có những giây phút cuối tuần thật trọn vẹn, bình yên bên những người thân yêu! 💖🎉"
                )
                $greetingMsg = $satGreetings | Get-Random
            } elseif ($dayOfWeek -eq [DayOfWeek]::Sunday) {
                # Chu nhat
                $greetingMsg = "☀️ Chào buổi sáng Chủ Nhật! Chúc mọi người một ngày cuối tuần thật thư thái, hạnh phúc và tràn ngập niềm vui bên gia đình nhé! ☕🌷"
            } elseif ($dayOfWeek -eq [DayOfWeek]::Monday) {
                # Thu 2 - Khoi dau tuan moi
                $monGreetings = @(
                    "🌅 Chào buổi sáng đầu tuần cả nhà! Chúc mọi người một tuần mới tràn đầy năng lượng, công việc suôn sẻ, bứt phá chỉ tiêu và ngập tràn niềm vui! ☕💪🚀",
                    "☀️ Chúc cả nhà một ngày thứ 2 khởi đầu tuần mới thật hứng khởi, làm việc an toàn, hiệu quả và gặt hái thật nhiều thành công nhé! 🌟🍀"
                )
                $greetingMsg = $monGreetings | Get-Random
            } else {
                # Cac ngay trong tuan (Thu 3, 4, 5, 6)
                $weekdayGreetings = @(
                    "☀️ Chào buổi sáng cả nhà! Chúc mọi người một ngày làm việc tràn đầy năng lượng, an toàn và mọi việc thật thuận lợi, hiệu quả nhé! ☕💪",
                    "🌅 Good morning cả nhà! Chúc anh chị em một ngày mới nhiều niềm vui, công việc suôn sẻ, luôn giữ vững tinh thần làm việc tích cực và thành công! 🌿✨",
                    "🌸 Chúc mọi người một ngày mới tràn đầy nhiệt huyết! Chúc các bộ phận hôm nay vận hành an toàn, đạt năng suất cao và hoàn thành tốt mọi kế hoạch! 🎯🍀",
                    "☀️ Chào ngày mới! Chúc toàn thể anh chị em một ngày làm việc vui vẻ, tập trung và đạt được những kết quả thật tuyệt vời nhé! ☕🌺"
                )
                $greetingMsg = $weekdayGreetings | Get-Random
            }

            Write-Host "[$($now.ToString('HH:mm:ss'))] >>> Gui loi chao buoi sang vao nhom Zalo Daily Report <<<" -ForegroundColor Cyan
            & powershell.exe -ExecutionPolicy Bypass -File $zaloSendScript -GroupName $script:zaloDailyReportGroup -Message $greetingMsg
            $script:lastMorningGreetingDate = $todayStr
        }
    } catch {
        Write-Host "Loi khi gui loi chao buoi sang Zalo: $_" -ForegroundColor Red
    }

    # Nghỉ 15 giây trước khi lặp lại
    Start-Sleep -Seconds 15
}
