# scripts/RegisterStoreIntakeTask.ps1

$taskName = "SendStoreIntakeReportZalo"
$scriptPath = "C:\Users\prod.public\Ortholite Vietnam\OVN Production - Documents\PRODUCTION\TRUONG OFFICE\PROJECT\KPI APP\APP KPI\scripts\StoreIntakeReport.ps1"

# Unregister if exists
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

# Action: Run PowerShell script hidden
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$scriptPath`""

# Triggers: 10:00, 14:00, and 16:00 daily
$trigger10 = New-ScheduledTaskTrigger -Daily -At "10:00"
$trigger14 = New-ScheduledTaskTrigger -Daily -At "14:00"
$trigger16 = New-ScheduledTaskTrigger -Daily -At "16:00"

# Settings
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RunOnlyIfNetworkAvailable:$false

# Principal: Run as current user (Interactive is required for UI automation to work with Zalo)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive

# Register Task
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger @($trigger10, $trigger14, $trigger16) -Settings $settings -Principal $principal -Description "Tu dong gui bao cao nhap kho (Excel) qua Zalo vao 10h, 14h va 16h."

Write-Host "Da dang ky Task Scheduler thanh cong: $taskName" -ForegroundColor Green
Write-Host "Thoi gian chay: 10:00, 14:00, va 16:00 moi ngay." -ForegroundColor Cyan
