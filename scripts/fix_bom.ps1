$path = "c:\Users\prod.public\Ortholite Vietnam\OVN Production - Documents\PRODUCTION\TRUONG OFFICE\PROJECT\KPI APP\APP KPI\scripts\MQAAAutomation.ps1"
$content = [System.IO.File]::ReadAllText($path, (New-Object System.Text.UTF8Encoding($false)))
[System.IO.File]::WriteAllText($path, $content, (New-Object System.Text.UTF8Encoding($true)))
Write-Host "Done"
