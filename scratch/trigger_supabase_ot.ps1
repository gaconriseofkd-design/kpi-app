$SUPABASE_URL = "https://ewhfhputqeyebffjwtnl.supabase.co"
$SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3aGZocHV0cWV5ZWJmZmp3dG5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyOTU1OTMsImV4cCI6MjEwNDg3MTU5M30.a368bZeQDr2du8R4ipKHpMZm0ITJlIqeD6wqba-fbRM"

$headers = @{
    "apikey"        = $SUPABASE_KEY
    "Authorization" = "Bearer $SUPABASE_KEY"
    "Content-Type"  = "application/json"
    "Prefer"        = "return=representation"
}

$body = @{
    "report_type" = "ot_report"
    "status"      = "pending"
} | ConvertTo-Json

Write-Host "Sending report_request to Supabase..." -ForegroundColor Cyan
$res = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/report_requests" -Headers $headers -Method Post -Body $body
Write-Host "Inserted Supabase Request ID: $($res[0].id), Status: $($res[0].status)" -ForegroundColor Green
