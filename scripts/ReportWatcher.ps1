# scripts/ReportWatcher.ps1
# Script này chạy ẩn qua 1 file bat duy nhất (Report Watcher Auto-Start) để quản lý & tự động gửi tất cả các báo cáo Zalo.

$SUPABASE_URL = "https://doyipagavbxupiwbitgi.supabase.co"
$SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRveWlwYWdhdmJ4dXBpd2JpdGdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMTc0NzUsImV4cCI6MjA3NDc5MzQ3NX0.hRCtL5wOxFXFPAR_r0vyYsL044d0caT-EZqx-p9kva0"

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
    
    # Nghỉ 15 giây trước khi lặp lại
    Start-Sleep -Seconds 15
}
