# scripts/Test_MQAA_Patrol.ps1
# Script dùng để TEST gửi báo cáo MQAA Patrol (Logic: Báo cáo ngày hôm trước)

$SUPABASE_URL = "https://doyipagavbxupiwbitgi.supabase.co"
$SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRveWlwYWdhdmJ4dXBpd2JpdGdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMTc0NzUsImV4cCI6MjA3NDc5MzQ3NX0.hRCtL5wOxFXFPAR_r0vyYsL044d0caT-EZqx-p9kva0"
$PATROL_ZALO_GROUP = "My Documents" 

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms
$L_SEP = "-----------------------"
$diamondEmoji = [char]0xD83D + [char]0xDD39
$userEmoji = [char]0xD83D + [char]0xDC64
$starEmoji = [char]0xD83D + [char]0xDCAF
$E_WARNING = [char]0x26A0 + [char]0xFE0F
$A_HUYEN = [char]0x00E0 # à

# Các nhãn tiếng Việt dùng mã Hex
$L_TITLE_PREFIX = [char]0xD83D + [char]0xDCCB + " *PHI" + [char]0x1EBE + "U T" + [char]0x1ED4 + "NG K" + [char]0x1EBE + "T MQAA*"
$L_SUMMARY_DAILY = "*T" + [char]0x1ED4 + "NG K" + [char]0x1EBE + "T B" + [char]0x1ED8 + " PH" + [char]0x1EAC + "N TRONG NG" + [char]0x00C0 + "Y*"
$L_ERROR_DETAIL = "*CHI TI" + [char]0x1EBE + "T C" + [char]0x00C1 + "C L" + [char]0x1ED6 + "I:*"

function Send-ZaloMessage {
    param([string]$text)
    [System.Windows.Forms.Clipboard]::SetText($text, [System.Windows.Forms.TextDataFormat]::UnicodeText)
    [System.Windows.Forms.SendKeys]::SendWait("^v")
    Start-Sleep -Milliseconds 500
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Start-Sleep -Milliseconds 500
}

function Send-ZaloImageGroup {
    param([string[]]$imageUrls)
    if ($imageUrls.Count -eq 0) { return }
    $tempFolder = Join-Path $env:TEMP ("mqaa_test_" + (Get-Date -Format "yyyyMMdd_HHmmss"))
    $null = New-Item -ItemType Directory -Path $tempFolder -Force
    $filePaths = New-Object System.Collections.Specialized.StringCollection
    try {
        foreach ($url in $imageUrls) {
            $localPath = Join-Path $tempFolder ("img_$(Get-Random).jpg")
            Invoke-WebRequest -Uri $url -OutFile $localPath -UserAgent "Mozilla/5.0"
            if (Test-Path $localPath) { [void]$filePaths.Add($localPath) }
        }
        [System.Windows.Forms.Clipboard]::SetFileDropList($filePaths)
        [System.Windows.Forms.SendKeys]::SendWait("^v")
        Start-Sleep -Milliseconds 3000
        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
        Start-Sleep -Seconds 2
    }
    finally { if (Test-Path $tempFolder) { Remove-Item -Path $tempFolder -Recurse -Force } }
}

try {
    # Mặc định lấy ngày hôm trước để đúng logic thực tế
    $targetDate = (Get-Date).AddDays(-1).ToString("yyyy-MM-dd")
    $headers = @{ "apikey" = $SUPABASE_KEY; "Authorization" = "Bearer $SUPABASE_KEY" }
    Write-Host ">>> BẮT ĐẦU TEST (Dữ liệu ngày hôm trước: $targetDate)..." -ForegroundColor Yellow

    $zaloProcess = Get-Process -Name Zalo -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle } | Select-Object -First 1
    if (-not $zaloProcess) { throw "Hãy mở Zalo PC trước." }
    Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);' -Name "Win32" -Namespace "Util" -ErrorAction SilentlyContinue
    [Util.Win32]::SetForegroundWindow($zaloProcess.MainWindowHandle)
    Start-Sleep -Seconds 2

    # Tìm nhóm
    [System.Windows.Forms.SendKeys]::SendWait("^f")
    Start-Sleep -Milliseconds 800
    [System.Windows.Forms.Clipboard]::SetText($PATROL_ZALO_GROUP, [System.Windows.Forms.TextDataFormat]::UnicodeText)
    [System.Windows.Forms.SendKeys]::SendWait("^v")
    Start-Sleep -Seconds 1
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Start-Sleep -Seconds 1

    $patrolUrl = "$SUPABASE_URL/rest/v1/mqaa_patrol_logs?date=eq.$targetDate&select=auditor_name,auditor_id,date,section,overall_performance,evaluation_data"
    $patrolData = Invoke-RestMethod -Uri $patrolUrl -Headers $headers -Method Get
    
    # Fallback chỉ dùng khi test nếu ngày hôm qua không có dữ liệu
    if (-not $patrolData -or $patrolData.Count -eq 0) {
        Write-Host "--- Không có dữ liệu cho ngày $targetDate. Thử lấy ngày 07/05 để demo..." -ForegroundColor Gray
        $targetDate = "2026-05-07"
        $patrolData = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/mqaa_patrol_logs?date=eq.$targetDate&select=auditor_name,auditor_id,date,section,overall_performance,evaluation_data" -Headers $headers -Method Get
    }

    if (-not $patrolData -or $patrolData.Count -eq 0) { throw "Không tìm thấy dữ liệu." }

    $allSections = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/mqaa_patrol_sections?select=name&order=sort_order.asc" -Headers $headers -Method Get
    $auditorGroups = $patrolData | Group-Object auditor_id

    foreach ($auditorGroup in $auditorGroups) {
        $auditorName = $auditorGroup.Group[0].auditor_name
        $evidenceItems = @()
        $patrolMsg = $L_TITLE_PREFIX + "`n" + $userEmoji + " *Auditor: $auditorName - Ng" + $A_HUYEN + "y: " + (Get-Date $targetDate).ToString("dd/MM") + "*`n" + $L_SEP + "`n"
        
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
        $patrolMsg += $L_SEP + "`n" + $starEmoji + " **Performance: " + ([Math]::Round(($auditorGroup.Group | Measure-Object overall_performance -Average).Average, 1)) + "%**"
        
        if ($evidenceItems.Count -gt 0) {
            $patrolMsg += "`n`n" + $E_WARNING + " " + $L_ERROR_DETAIL + "`n"
            $imgs = @()
            foreach ($ev in $evidenceItems) {
                $patrolMsg += "- **$($ev.Section)**: $($ev.Text)`n"
                if ($ev.Image) { $imgs += $ev.Image }
            }
            Send-ZaloMessage -text $patrolMsg
            if ($imgs.Count -gt 0) { Send-ZaloImageGroup -imageUrls ($imgs | Select-Object -Unique) }
        } else { Send-ZaloMessage -text $patrolMsg }
        Start-Sleep -Seconds 1
    }

    # Bảng tổng kết ngày
    $summaryMsg = $L_TITLE_PREFIX + "`n" + $L_SUMMARY_DAILY + "`n*(Ng" + $A_HUYEN + "y: " + (Get-Date $targetDate).ToString("dd/MM/yyyy") + ")*`n" + $L_SEP + "`n"
    $oSum = 0; $oCount = 0
    $dStats = $patrolData | Group-Object { $_.section.Replace("_", " ") }
    foreach ($sec in $allSections) {
        $m = $dStats | Where-Object { $_.Name -eq $sec.name }
        if ($m) {
            $score = [Math]::Round(($m.Group | Measure-Object overall_performance -Average).Average, 1)
            $summaryMsg += $diamondEmoji + " **$($sec.name)**: $score%`n"
            $oSum += $score; $oCount++
        } else { $summaryMsg += $diamondEmoji + " **$($sec.name)**: ...`n" }
    }
    $summaryMsg += $L_SEP + "`n" + $starEmoji + " **Overall Daily Performance: " + ([Math]::Round($oSum/$oCount, 1)) + "%**"
    Send-ZaloMessage -text $summaryMsg

    Write-Host ">>> HOÀN TẤT!" -ForegroundColor Green
} catch { Write-Host "Loi: $_" -ForegroundColor Red }
