# scripts/reset_patrol_and_run.ps1
# Reset trạng thái gửi Phiếu Tổng Kết và chạy lại script

$SUPABASE_URL = "https://doyipagavbxupiwbitgi.supabase.co"
$SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRveWlwYWdhdmJ4dXBpd2JpdGdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMTc0NzUsImV4cCI6MjA3NDc5MzQ3NX0.hRCtL5wOxFXFPAR_r0vyYsL044d0caT-EZqx-p9kva0"

$headers = @{
    "apikey"        = $SUPABASE_KEY
    "Authorization" = "Bearer $SUPABASE_KEY"
}

$settingsUrl = "$SUPABASE_URL/rest/v1/mqaa_settings?id=eq.1"

Write-Host "=== Reset last_patrol_report_monday ===" -ForegroundColor Yellow
$updateBody = '{"last_patrol_report_monday": null}'
$null = Invoke-RestMethod -Uri $settingsUrl -Headers $headers -Method Patch -Body $updateBody -ContentType "application/json"
Write-Host "Da reset last_patrol_report_monday = null" -ForegroundColor Green

Write-Host ""
Write-Host "=== Chay lai MQAAAutomation.ps1 ===" -ForegroundColor Yellow
& "$PSScriptRoot\MQAAAutomation.ps1"
