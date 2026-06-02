# scripts/ReportWatcher.ps1
# Script này sẽ chạy ẩn (hoặc qua Task Scheduler) để lắng nghe yêu cầu gửi báo cáo từ Web App.

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
$mqaaScript = Join-Path $scriptPath "MQAAAutomation.ps1"

Write-Host ">>> BAT DAU LANG NGHE YEU CAU GUI BAO CAO TU SUPABASE <<<" -ForegroundColor Cyan

while ($true) {
    try {
        # 1. Tìm các yêu cầu đang 'pending'
        $requestUrl = "$SUPABASE_URL/rest/v1/report_requests?status=eq.pending&select=*"
        $pendingRequests = Invoke-RestMethod -Uri $requestUrl -Headers $headers -Method Get

        if ($pendingRequests -and $pendingRequests.Count -gt 0) {
            foreach ($req in $pendingRequests) {
                Write-Host "------------------------------------------------" -ForegroundColor Yellow
                Write-Host "Phat hien yeu cau moi: ID = $($req.id), Type = $($req.report_type)" -ForegroundColor Green
                
                # 2. Đổi trạng thái sang 'processing' để tránh trùng lặp nếu chạy 2 watcher
                $updateProcessingUrl = "$SUPABASE_URL/rest/v1/report_requests?id=eq.$($req.id)"
                $bodyProcessing = "{`"status`":`"processing`"}"
                Invoke-RestMethod -Uri $updateProcessingUrl -Headers $headers -Method Patch -Body $bodyProcessing | Out-Null
                
                # 3. Kích hoạt báo cáo tương ứng
                $reportType = $req.report_type
                
                if ($reportType -eq "mqaa_patrol") {
                    Write-Host "Dang thuc thi MQAAAutomation.ps1..."
                    & powershell.exe -File $mqaaScript -ManualTrigger -TargetReport $reportType
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
    
    # Nghỉ 15 giây trước khi check lại
    Start-Sleep -Seconds 15
}
