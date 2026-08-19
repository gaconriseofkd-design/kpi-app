# scripts/Zalo_Send_Image.ps1
# Script nay PHAI chay trong cua so co the nhin thay (WindowStyle Normal)
# Duong dan anh OT co dinh - khong truyen param de tranh loi path-with-spaces

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$ImagePath = "c:\Users\prod.public\Ortholite Vietnam\OVN Production - Documents\PRODUCTION\TRUONG OFFICE\PROJECT\KPI APP\APP KPI\scratch\ot_pivot_report.png"

function Write-Log([string]$msg) {
    $t = Get-Date -Format "HH:mm:ss"
    Write-Host "[$t] $msg"
}

Write-Log "=== ZALO SEND IMAGE START ==="
Write-Log "Tim file anh tai: $ImagePath"

if (-not (Test-Path $ImagePath)) {
    Write-Log "KHONG TIM THAY FILE ANH: $ImagePath"
    Start-Sleep -Seconds 5
    exit 1
}

Write-Log "Da tim thay file anh OK!"
Write-Log "Chuan bi gui vao nhom Zalo Daily Report..."

$wshell = New-Object -ComObject WScript.Shell

# Thu kich hoat Zalo nhieu lan
$attempts = 0
$activated = $false
while (-not $activated -and $attempts -lt 10) {
    $activated = $wshell.AppActivate("Zalo - Auto Report")
    if (-not $activated) { $activated = $wshell.AppActivate("Zalo") }
    if (-not $activated) {
        foreach ($p in (Get-Process Zalo -ErrorAction SilentlyContinue)) {
            try {
                $r = $wshell.AppActivate($p.Id)
                if ($r) { $activated = $true; break }
            } catch {}
        }
    }
    if (-not $activated) {
        $attempts++
        Write-Log "Thu ${attempts}: Chua focus duoc Zalo, doi 1s..."
        Start-Sleep -Seconds 1
    }
}

Write-Log "Ket qua focus Zalo: $activated (sau $attempts lan thu)"
Start-Sleep -Milliseconds 1000

# Tim nhom Daily Report bang Ctrl+F
Write-Log "Tim nhom Daily Report..."
$wshell.SendKeys("^f")
Start-Sleep -Milliseconds 1000
[System.Windows.Forms.Clipboard]::SetText("Daily Report", [System.Windows.Forms.TextDataFormat]::UnicodeText)
$wshell.SendKeys("^v")
Start-Sleep -Seconds 2
$wshell.SendKeys("~")
Start-Sleep -Seconds 2

# Dat anh vao clipboard va dan vao Zalo
Write-Log "Dan anh vao Zalo..."
try {
    $imgObj = [System.Drawing.Image]::FromFile($ImagePath)
    [System.Windows.Forms.Clipboard]::SetImage($imgObj)
    $imgObj.Dispose()
    Write-Log "Da dat anh vao clipboard OK"
} catch {
    Write-Log "Loi dat anh vao clipboard: $_"
    Start-Sleep -Seconds 5
    exit 1
}

Start-Sleep -Milliseconds 500
$wshell.SendKeys("^v")
Write-Log "Da nhan Ctrl+V - cho Zalo hien modal xem truoc anh (4 giay)..."
Start-Sleep -Seconds 4

$wshell.SendKeys("~")
Write-Log "Da nhan Enter de gui anh!"
Start-Sleep -Seconds 2

Write-Log "=== HOAN THANH! Da gui anh OT vao nhom Daily Report. ==="
Start-Sleep -Seconds 3
exit 0
