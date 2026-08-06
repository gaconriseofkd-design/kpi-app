# scratch/build_exe.ps1
# Script to build the exe outside of OneDrive to avoid the "UNKNOWN: unknown error, read" error.

$ws = "c:\Users\truong.nx1\Ortholite Vietnam\OVN Production - Documents\PRODUCTION\TRUONG OFFICE\PROJECT\KPI APP\APP KPI"
$tempDir = "C:\Users\truong.nx1\kpi-app-build"

Write-Host ">>> Khoi tao thu muc build tam thoi tai: $tempDir" -ForegroundColor Cyan
if (Test-Path $tempDir) {
    Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

Write-Host ">>> Copying files..." -ForegroundColor Cyan
Copy-Item -Path "$ws\server.cjs" -Destination "$tempDir\server.cjs"
Copy-Item -Path "$ws\package.json" -Destination "$tempDir\package.json"
Copy-Item -Path "$ws\dist" -Destination "$tempDir\dist" -Recurse

Write-Host ">>> Installing package dependencies locally in temp folder..." -ForegroundColor Cyan
# Run npm install in temp dir
Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd /d `"$tempDir`" && npm install express @supabase/supabase-js pkg ws" -NoNewWindow -Wait

Write-Host ">>> Running pkg compiler..." -ForegroundColor Cyan
Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd /d `"$tempDir`" && npx pkg server.cjs --config package.json --targets node18-win-x64 --output kpi-app.exe" -NoNewWindow -Wait

if (Test-Path "$tempDir\kpi-app.exe") {
    Write-Host ">>> Packaging thanh cong! Copying file .exe ve workspace..." -ForegroundColor Green
    if (!(Test-Path "$ws\dist-exe")) {
        New-Item -ItemType Directory -Path "$ws\dist-exe" -Force | Out-Null
    }
    Copy-Item -Path "$tempDir\kpi-app.exe" -Destination "$ws\dist-exe\kpi-app.exe" -Force
    Write-Host ">>> Da copy file exe ve $ws\dist-exe\kpi-app.exe" -ForegroundColor Green
    
    Write-Host ">>> Cleaning up temp folder..." -ForegroundColor Cyan
    Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host ">>> HOAN THANH!" -ForegroundColor Green
} else {
    Write-Host ">>> ERROR: Khong tao duoc file exe trong thu muc build tam." -ForegroundColor Red
}
