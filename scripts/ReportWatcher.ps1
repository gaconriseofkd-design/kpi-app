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

    # 6. Kiem tra gui bao cao Employees Voice luc 08:00 (hoac ngay khi bat lai neu chua gui trong ngay)
    try {
        $currentHour = (Get-Date).Hour
        $currentMinute = (Get-Date).Minute
        $currentDate = (Get-Date).ToString("yyyy-MM-dd")
        
        # Kiem tra neu tu 8h tro di va chua gui trong ngay hom nay
        if ($currentHour -ge 8 -and $script:lastAutoVoiceReport -ne $currentDate) {
            # Kiem tra xem nguoi dung co bat tu dong khong
            $sysData = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/system_settings?id=eq.1" -Headers $headers -Method Get
            $isVoiceEnabled = $true
            if ($sysData -and $sysData.Count -gt 0) {
                if ($sysData[0].is_employees_voice_enabled -eq $false) {
                    $isVoiceEnabled = $false
                }
            }

            if ($isVoiceEnabled) {
                Write-Host ">>> Kich hoat KIEM TRA & GUI bao cao Employees Voice (08:00) <<<" -ForegroundColor Green
                & powershell.exe -ExecutionPolicy Bypass -File $voiceScript -Action "AutoCheck"
            } else {
                Write-Host ">>> Bao cao Employees Voice tu dong dang bi TAT tren he thong <<<" -ForegroundColor Yellow
            }
            $script:lastAutoVoiceReport = $currentDate
        }
    } catch {
        Write-Host "Loi khi chay Employees Voice tu dong: $_" -ForegroundColor Red
    }
    
    # Nghỉ 15 giây trước khi lặp lại
    Start-Sleep -Seconds 15
}
