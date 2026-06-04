
$SUPABASE_URL = "https://doyipagavbxupiwbitgi.supabase.co"
$SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRveWlwYWdhdmJ4dXBpd2JpdGdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMTc0NzUsImV4cCI6MjA3NDc5MzQ3NX0.hRCtL5wOxFXFPAR_r0vyYsL044d0caT-EZqx-p9kva0"
$headers = @{ "apikey" = $SUPABASE_KEY; "Authorization" = "Bearer $SUPABASE_KEY" }
Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/system_settings?select=*" -Headers $headers | Format-List

