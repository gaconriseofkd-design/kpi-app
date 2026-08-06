# build_desktop_exe.ps1
$tempDir = "C:\Users\truong.nx1\kpi-app-desktop-build"
$workspace = "c:\Users\truong.nx1\Ortholite Vietnam\OVN Production - Documents\PRODUCTION\TRUONG OFFICE\PROJECT\KPI APP\APP KPI"
$pyinstallerPath = "C:\Users\truong.nx1\AppData\Local\Programs\Python\Python312\Scripts\pyinstaller.exe"

Write-Output ">>> Khoi tao thu muc build tam thoi tai: $tempDir"
if (Test-Path $tempDir) {
    Remove-Item -Recurse -Force $tempDir
}
New-Item -ItemType Directory -Force -Path $tempDir

Write-Output ">>> Copying files..."
Copy-Item -Path "$workspace\desktop_app.py" -Destination "$tempDir\"
Copy-Item -Path "$workspace\dist" -Destination "$tempDir\dist" -Recurse

# Thuc hien build
Write-Output ">>> Running PyInstaller compiler..."
Set-Location -Path $tempDir
& $pyinstallerPath --noconsole --onefile --name "KPI App" --add-data "dist;dist" --distpath "$tempDir\release-temp" desktop_app.py

Write-Output ">>> Compilation finished! Copying executable back to workspace..."
Set-Location -Path $workspace

if (!(Test-Path "$workspace\release")) {
    New-Item -ItemType Directory -Force -Path "$workspace\release"
}

Copy-Item -Path "$tempDir\release-temp\KPI App.exe" -Destination "$workspace\release\KPI App.exe" -Force
Write-Output ">>> Copied KPI App.exe to release/ folder."

# Cleanup
Write-Output ">>> Cleaning up temp folder..."
Remove-Item -Recurse -Force $tempDir
Write-Output ">>> HOAN THANH!"
