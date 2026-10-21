# scripts/reset_patrol_and_run.ps1
# Reset trạng thái gửi Phiếu Tổng Kết và chạy lại script

$SUPABASE_URL = "https://ewhfhputqeyebffjwtnl.supabase.co"
$SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3aGZocHV0cWV5ZWJmZmp3dG5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyOTU1OTMsImV4cCI6MjEwNDg3MTU5M30.a368bZeQDr2du8R4ipKHpMZm0ITJlIqeD6wqba-fbRM"

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
