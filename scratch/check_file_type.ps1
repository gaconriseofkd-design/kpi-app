$path = "c:\Users\prod.public\Ortholite Vietnam\OVN Production - Documents\PRODUCTION\TRUONG OFFICE\PROJECT\KPI APP\APP KPI\% OT.xlsx"
$stream = [System.IO.File]::OpenRead($path)
$bytes = New-Object byte[] 10
$stream.Read($bytes, 0, 10) | Out-Null
$stream.Close()

$hex = ($bytes | ForEach-Object { $_.ToString("X2") }) -join " "
Write-Host "Magic bytes: $hex"
