# scripts/SendReport_22_23May_Focus.ps1
# Script gửi lại báo cáo Patrol ngày 22/05 và 23/05 vào Zalo, có focus window

$SUPABASE_URL = "https://doyipagavbxupiwbitgi.supabase.co"
$SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRveWlwYWdhdmJ4dXBpd2JpdGdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMTc0NzUsImV4cCI6MjA3NDc5MzQ3NX0.hRCtL5wOxFXFPAR_r0vyYsL044d0caT-EZqx-p9kva0"
$PATROL_ZALO_GROUP = "MQAA TESTING REPORT"
$DATES_TO_SEND = @("2026-05-22", "2026-05-23")

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms

# === Win32 API: ShowWindow + SetForegroundWindow ===
$win32Src = @"
using System;
using System.Runtime.InteropServices;
public class WinHelper {
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmd);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
}
"@
Add-Type -TypeDefinition $win32Src -Language CSharp -ErrorAction SilentlyContinue

$script:zaloHandle   = [IntPtr]::Zero
$script:myHandle     = [IntPtr]::Zero

function Focus-Zalo {
    if ($script:myHandle -ne [IntPtr]::Zero) {
        [WinHelper]::ShowWindow($script:myHandle, 6) | Out-Null
    }
    
    $zaloThread = [WinHelper]::GetWindowThreadProcessId($script:zaloHandle, [ref]0)
    $myThread = [WinHelper]::GetCurrentThreadId()
    $fgWindow = [WinHelper]::GetForegroundWindow()
    $fgThread = [WinHelper]::GetWindowThreadProcessId($fgWindow, [ref]0)
    
    if ($fgThread -ne $zaloThread) {
        [WinHelper]::AttachThreadInput($myThread, $zaloThread, $true) | Out-Null
        [WinHelper]::AttachThreadInput($fgThread, $zaloThread, $true) | Out-Null
    }
    
    [WinHelper]::ShowWindow($script:zaloHandle, 9) | Out-Null
    Start-Sleep -Milliseconds 300
    [WinHelper]::SetForegroundWindow($script:zaloHandle) | Out-Null
    
    if ($fgThread -ne $zaloThread) {
        [WinHelper]::AttachThreadInput($myThread, $zaloThread, $false) | Out-Null
        [WinHelper]::AttachThreadInput($fgThread, $zaloThread, $false) | Out-Null
    }
    Start-Sleep -Milliseconds 500
}

# === Emoji & Nhan ===
$L_SEP      = "-----------------------"
$diamondEmoji = [char]0xD83D + [char]0xDD39
$userEmoji    = [char]0xD83D + [char]0xDC64
$starEmoji    = [char]0xD83D + [char]0xDCAF
$E_WARNING    = [char]0x26A0 + [char]0xFE0F
$A_HUYEN      = [char]0x00E0

$L_TITLE_PREFIX  = [char]0xD83D + [char]0xDCCB + " *PHIE" + [char]0x1EBE + "U TO" + [char]0x1ED4 + "NG KE" + [char]0x1EBE + "T MQAA*"
$L_SUMMARY_DAILY = "*TO" + [char]0x1ED4 + "NG KE" + [char]0x1EBE + "T BO" + [char]0x1ED8 + " PHA" + [char]0x1EAC + "N TRONG NG" + [char]0x00C0 + "Y*"
$L_ERROR_DETAIL  = "*CHI TIE" + [char]0x1EBE + "T CA" + [char]0x00C1 + "C LO" + [char]0x1ED6 + "I:*"

function Send-ZaloMessage {
    param([string]$text)
    Focus-Zalo
    [System.Windows.Forms.Clipboard]::SetText($text, [System.Windows.Forms.TextDataFormat]::UnicodeText)
    Start-Sleep -Milliseconds 200
    [System.Windows.Forms.SendKeys]::SendWait("^v")
    Start-Sleep -Milliseconds 600
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Start-Sleep -Milliseconds 800
}

function Send-ZaloImageGroup {
    param([string[]]$imageUrls)
    if ($imageUrls.Count -eq 0) { return }
    $tempFolder = Join-Path $env:TEMP ("mqaa_send_" + (Get-Date -Format "yyyyMMdd_HHmmss"))
    $null = New-Item -ItemType Directory -Path $tempFolder -Force
    $filePaths = New-Object System.Collections.Specialized.StringCollection
    try {
        foreach ($url in $imageUrls) {
            $localPath = Join-Path $tempFolder ("img_$(Get-Random).jpg")
            Invoke-WebRequest -Uri $url -OutFile $localPath -UserAgent "Mozilla/5.0"
            if (Test-Path $localPath) { [void]$filePaths.Add($localPath) }
        }
        Focus-Zalo
        [System.Windows.Forms.Clipboard]::SetFileDropList($filePaths)
        Start-Sleep -Milliseconds 200
        [System.Windows.Forms.SendKeys]::SendWait("^v")
        Start-Sleep -Milliseconds 3000
        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
        Start-Sleep -Seconds 3
    }
    finally { if (Test-Path $tempFolder) { Remove-Item -Path $tempFolder -Recurse -Force -ErrorAction SilentlyContinue } }
}

function Send-PatrolReport {
    param([string]$targetDate)

    $headers = @{
        "apikey"        = $SUPABASE_KEY
        "Authorization" = "Bearer $SUPABASE_KEY"
    }

    Write-Host "`n============================================" -ForegroundColor Cyan
    Write-Host ">>> GUI BAO CAO NGAY: $targetDate" -ForegroundColor Yellow
    Write-Host "============================================" -ForegroundColor Cyan

    $patrolUrl = "$SUPABASE_URL/rest/v1/mqaa_patrol_logs?date=eq.$targetDate&select=auditor_name,auditor_id,date,section,overall_performance,evaluation_data"
    $patrolData = Invoke-RestMethod -Uri $patrolUrl -Headers $headers -Method Get

    if (-not $patrolData -or $patrolData.Count -eq 0) {
        Write-Host "--- Khong co du lieu cho ngay $targetDate. Bo qua." -ForegroundColor Gray
        return $false
    }

    Write-Host "Tim thay $($patrolData.Count) ban ghi." -ForegroundColor Green
    $allSections = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/mqaa_patrol_sections?select=name&order=sort_order.asc" -Headers $headers -Method Get
    $dateObj = Get-Date $targetDate
    $auditorGroups = $patrolData | Group-Object auditor_id

    foreach ($auditorGroup in $auditorGroups) {
        $auditorName = $auditorGroup.Group[0].auditor_name
        $evidenceItems = @()
        $patrolMsg = $L_TITLE_PREFIX + "`n" + $userEmoji + " *Auditor: $auditorName - Ng" + $A_HUYEN + "y: " + $dateObj.ToString("dd/MM") + "*`n" + $L_SEP + "`n"

        $secGroups = $auditorGroup.Group | Group-Object { $_.section.Replace("_", " ") }
        foreach ($sg in $secGroups) {
            $score = [Math]::Round(($sg.Group | Measure-Object overall_performance -Average).Average, 1)
            $patrolMsg += $diamondEmoji + " **$($sg.Name)**: $score%`n"
            if ($score -lt 100) {
                foreach ($rec in $sg.Group) {
                    if ($rec.evaluation_data) {
                        foreach ($item in $rec.evaluation_data) {
                            $isHeader = if ($item.is_header -ne $null) { $item.is_header } else { $item.isHeader }
                            if (-not $isHeader -and [double]$item.level -lt [double]$item.score) {
                                $desc = if ($item.description) { $item.description } else { $item.label }
                                $evidenceItems += [PSCustomObject]@{ Section = $sg.Name; Text = $desc; Image = $item.image_url }
                            }
                        }
                    }
                }
            }
        }
        $avgPerf = [Math]::Round(($auditorGroup.Group | Measure-Object overall_performance -Average).Average, 1)
        $patrolMsg += $L_SEP + "`n" + $starEmoji + " **Performance: $avgPerf%**"

        if ($evidenceItems.Count -gt 0) {
            $patrolMsg += "`n`n" + $E_WARNING + " " + $L_ERROR_DETAIL + "`n"
            $imgs = @()
            foreach ($ev in $evidenceItems) {
                $patrolMsg += "- **$($ev.Section)**: $($ev.Text)`n"
                if ($ev.Image) { $imgs += $ev.Image }
            }
            Send-ZaloMessage -text $patrolMsg
            if ($imgs.Count -gt 0) { Send-ZaloImageGroup -imageUrls ($imgs | Select-Object -Unique) }
        } else {
            Send-ZaloMessage -text $patrolMsg
        }
        Start-Sleep -Seconds 1
    }

    $summaryMsg = $L_TITLE_PREFIX + "`n" + $L_SUMMARY_DAILY + "`n*(Ng" + $A_HUYEN + "y: " + $dateObj.ToString("dd/MM/yyyy") + ")*`n" + $L_SEP + "`n"
    $oSum = 0; $oCount = 0
    $dStats = $patrolData | Group-Object { $_.section.Replace("_", " ") }
    foreach ($sec in $allSections) {
        $m = $dStats | Where-Object { $_.Name -eq $sec.name }
        if ($m) {
            $score = [Math]::Round(($m.Group | Measure-Object overall_performance -Average).Average, 1)
            $summaryMsg += $diamondEmoji + " **$($sec.name)**: $score%`n"
            $oSum += $score; $oCount++
        } else {
            $summaryMsg += $diamondEmoji + " **$($sec.name)**: ...`n"
        }
    }
    if ($oCount -gt 0) {
        $summaryMsg += $L_SEP + "`n" + $starEmoji + " **Overall Daily Performance: " + ([Math]::Round($oSum/$oCount, 1)) + "%**"
    }
    Send-ZaloMessage -text $summaryMsg

    Write-Host ">>> HOAN TAT gui bao cao ngay $targetDate!" -ForegroundColor Green
    return $true
}

try {
    $zaloProcess = Get-Process -Name Zalo -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle } | Select-Object -First 1
    if (-not $zaloProcess) { throw "Hay mo Zalo PC truoc!" }

    $script:zaloHandle = $zaloProcess.MainWindowHandle
    $script:myHandle   = (Get-Process -Id $PID).MainWindowHandle

    Focus-Zalo
    [System.Windows.Forms.SendKeys]::SendWait("^f")
    Start-Sleep -Milliseconds 800
    [System.Windows.Forms.Clipboard]::SetText($PATROL_ZALO_GROUP, [System.Windows.Forms.TextDataFormat]::UnicodeText)
    [System.Windows.Forms.SendKeys]::SendWait("^v")
    Start-Sleep -Seconds 1
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Start-Sleep -Seconds 1

    $lastSuccessDate = $null
    foreach ($date in $DATES_TO_SEND) {
        $ok = Send-PatrolReport -targetDate $date
        if ($ok) { $lastSuccessDate = $date }
        Start-Sleep -Seconds 2
    }

    if ($lastSuccessDate) {
        $headers = @{
            "apikey"        = $SUPABASE_KEY
            "Authorization" = "Bearer $SUPABASE_KEY"
            "Content-Type"  = "application/json"
        }
        $body = "{`"last_patrol_report_monday`":`"$lastSuccessDate`"}"
        $null = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/mqaa_settings?id=eq.1" -Headers $headers -Method Patch -Body $body
        Write-Host "`n>>> Da cap nhat last_patrol_report_monday = $lastSuccessDate" -ForegroundColor Cyan
    }

    Write-Host "`n=== HOAN THANH! ===" -ForegroundColor Green
    Start-Sleep -Seconds 3

} catch {
    Write-Host "LOI: $_" -ForegroundColor Red
    Start-Sleep -Seconds 5
    exit 1
}
