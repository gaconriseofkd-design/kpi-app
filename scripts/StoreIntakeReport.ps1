# scripts/StoreIntakeReport.ps1
param(
    [switch]$ManualTrigger,
    [string]$TargetReport = ""
)

$SUPABASE_URL = "https://doyipagavbxupiwbitgi.supabase.co"
$SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRveWlwYWdhdmJ4dXBpd2JpdGdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMTc0NzUsImV4cCI6MjA3NDc5MzQ3NX0.hRCtL5wOxFXFPAR_r0vyYsL044d0caT-EZqx-p9kva0"
$headers = @{ "apikey" = $SUPABASE_KEY; "Authorization" = "Bearer $SUPABASE_KEY" }

$settings = $null
try {
    $settingUrl = "$SUPABASE_URL/rest/v1/system_settings?id=eq.1"
    $settingData = Invoke-RestMethod -Uri $settingUrl -Headers $headers -Method Get
    if ($settingData -and $settingData.Count -gt 0) {
        $settings = $settingData[0]
    }
} catch {
    Write-Host "Khong the kiem tra trang thai bao cao tu Supabase: $_" -ForegroundColor Red
}

# Determine which blocks to run
$runDaily = ($TargetReport -eq "daily_report") -or (-not $ManualTrigger -and $settings -and $settings.is_daily_report_enabled -eq $true)
$runHangBu = ($TargetReport -eq "hang_bu") -or (-not $ManualTrigger -and $settings -and $settings.is_hang_bu_enabled -eq $true -and (Get-Date).Hour -eq 16)
$runDelay = ($TargetReport -eq "delay_xuat_gap") -or (-not $ManualTrigger -and $settings -and $settings.is_delay_enabled -eq $true -and ((Get-Date).Hour -eq 10 -or (Get-Date).Hour -eq 16))
$runWip = ($TargetReport -eq "wip_report") -or (-not $ManualTrigger -and $settings -and $settings.is_wip_enabled -eq $true -and ((Get-Date).Hour -eq 8 -or (Get-Date).Hour -eq 16))

if (-not $runDaily -and -not $runHangBu -and -not $runDelay -and -not $runWip) {
    Write-Host "Khong co bao cao nao duoc kich hoat. Thoat." -ForegroundColor Yellow
    exit 0
}

$EXCEL_FILE_PATH = "C:\Users\prod.public\Ortholite Vietnam\OVN Production - Documents\PRODUCTION\TRUONG OFFICE\PROJECT\Dashboard Progress tracking\data\Powerapp (V21.10.25).xlsx"
$ZALO_TARGET_NAME = "Daily Report"

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# --- UI Automation Setup ---
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

$script:zaloHandle = [IntPtr]::Zero
$script:myHandle = (Get-Process -Id $PID).MainWindowHandle

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

# --- Main Logic ---
try {
    # Initialize Zalo
    Write-Host "Dang tim Zalo PC..." -ForegroundColor Cyan
    $zaloProcess = Get-Process -Name Zalo -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle } | Select-Object -First 1
    if (-not $zaloProcess) {
        throw "Hay mo Zalo PC truoc khi chay script!"
    }
    $script:zaloHandle = $zaloProcess.MainWindowHandle

    if ($runDaily) {
        Write-Host "Bat dau lay du lieu Excel cho Daily Report..." -ForegroundColor Cyan
        if (-not (Test-Path $EXCEL_FILE_PATH)) { throw "Khong tim thay file Excel tai: $EXCEL_FILE_PATH" }

        $excel = New-Object -ComObject Excel.Application
        $excel.Visible = $false
        $excel.DisplayAlerts = $false

        $workbook = $excel.Workbooks.Open($EXCEL_FILE_PATH, 0, $true)
        $sheet = $workbook.Sheets.Item("REALTIME STORED")

        if (-not $sheet) { throw "Khong tim thay sheet 'REALTIME STORED' trong file." }

        $molded = $sheet.Range("B2").Text
        $dieCut = $sheet.Range("B3").Text
        $others = $sheet.Range("B4").Text
        $total  = $sheet.Range("B5").Text

        $workbook.Close($false)
        $excel.Quit()
        [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
        $excel = $null

        if ($molded -match "Pairs") { $molded = $molded -replace "(?i)\s*Pairs\s*", "" }
        if ($dieCut -match "Pairs") { $dieCut = $dieCut -replace "(?i)\s*Pairs\s*", "" }
        if ($others -match "Pairs") { $others = $others -replace "(?i)\s*Pairs\s*", "" }
        if ($total -match "Pairs")  { $total  = $total -replace "(?i)\s*Pairs\s*", "" }

        $currentTime = Get-Date -Format "HH:mm dd/MM/yy"
        $reportMessage = "Tổng số lượng nhập kho đến hiện tại ($currentTime)`nMolded: $molded Pairs`nDie Cut: $dieCut Pairs`nOthers: $others Pairs`nTotal: $total Pairs"

        Write-Host "Noi dung bao cao Daily:"
        Write-Host $reportMessage -ForegroundColor Green

        Write-Host "Dang mo va focus Zalo..."
        Focus-Zalo
        Start-Sleep -Seconds 1

        [System.Windows.Forms.SendKeys]::SendWait("^f")
        Start-Sleep -Milliseconds 800
        [System.Windows.Forms.Clipboard]::SetText($ZALO_TARGET_NAME, [System.Windows.Forms.TextDataFormat]::UnicodeText)
        [System.Windows.Forms.SendKeys]::SendWait("^v")
        Start-Sleep -Seconds 2
        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
        Start-Sleep -Seconds 2

        [System.Windows.Forms.Clipboard]::SetText($reportMessage, [System.Windows.Forms.TextDataFormat]::UnicodeText)
        [System.Windows.Forms.SendKeys]::SendWait("^v")
        Start-Sleep -Milliseconds 600
        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
        Start-Sleep -Seconds 1
    }

    if ($runHangBu) {
        Write-Host "Bat dau doc va gui bao cao Hang Bu..." -ForegroundColor Cyan
        
        $SUPP_EXCEL_PATH = "C:\Users\prod.public\Ortholite Vietnam\OVN Production - Documents\PRODUCTION\Hiền\Report Lỗi thao tác supp 2026.xlsx"
        if (-not (Test-Path $SUPP_EXCEL_PATH)) {
            Write-Host "Khong tim thay file Excel hang bu: $SUPP_EXCEL_PATH" -ForegroundColor Red
        } else {
            $excelSupp = New-Object -ComObject Excel.Application
            $excelSupp.Visible = $false
            $excelSupp.DisplayAlerts = $false
            
            try {
                $wbSupp = $excelSupp.Workbooks.Open($SUPP_EXCEL_PATH, 0, $true)
                $shSupp = $null
                try { $shSupp = $wbSupp.Sheets.Item("2026") } catch {}
                if (-not $shSupp) { try { $shSupp = $wbSupp.Sheets.Item("DATA SUPPLEMENT") } catch {} }
                
                if (-not $shSupp) {
                    Write-Host "Khong tim thay sheet 2026 hoac DATA SUPPLEMENT!" -ForegroundColor Red
                } else {
                    $startCol = 2
                    $rowSuppPro = 51
                    $rowSuppTotal = 52
                    
                    $lastCol = $startCol
                    while ($true) {
                        $nextColValue = $shSupp.Cells.Item($rowSuppPro, $lastCol + 1).Text
                        if ([string]::IsNullOrWhiteSpace($nextColValue)) { break }
                        $lastCol++
                    }
                    
                    $suppProValue = $shSupp.Cells.Item($rowSuppPro, $lastCol).Text
                    $suppTotalValue = $shSupp.Cells.Item($rowSuppTotal, $lastCol).Text
                    
                    $wbSupp.Close($false)
                    $excelSupp.Quit()
                    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excelSupp) | Out-Null
                    $excelSupp = $null
                    
                    $yesterday = (Get-Date).AddDays(-1).ToString("dd/MM/yy")
                    $suppMessage = "Thông tin hàng bù đến ngày hôm qua $yesterday.`n% hàng bù thao tác sản xuất: $suppProValue;`nTổng % hàng bù: $suppTotalValue"
                    
                    Write-Host "Noi dung bao cao hang bu:"
                    Write-Host $suppMessage -ForegroundColor Green
                    
                    Focus-Zalo
                    Start-Sleep -Seconds 1
                    
                    [System.Windows.Forms.SendKeys]::SendWait("^f")
                    Start-Sleep -Milliseconds 800
                    [System.Windows.Forms.Clipboard]::SetText($ZALO_TARGET_NAME, [System.Windows.Forms.TextDataFormat]::UnicodeText)
                    [System.Windows.Forms.SendKeys]::SendWait("^v")
                    Start-Sleep -Seconds 2
                    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
                    Start-Sleep -Seconds 2

                    [System.Windows.Forms.Clipboard]::SetText($suppMessage, [System.Windows.Forms.TextDataFormat]::UnicodeText)
                    [System.Windows.Forms.SendKeys]::SendWait("^v")
                    Start-Sleep -Milliseconds 600
                    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
                    Start-Sleep -Seconds 1
                }
            } catch {
                Write-Host "Loi khi doc file hang bu: $_" -ForegroundColor Red
                if ($excelSupp) {
                    try { $excelSupp.Quit(); [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excelSupp) | Out-Null } catch {}
                }
            }
        }
    }

    if ($runDelay) {
        Write-Host "Bat dau doc va gui bao cao Delay-Xuat Gap..." -ForegroundColor Cyan
        
        $excelDLXG = New-Object -ComObject Excel.Application
        $excelDLXG.Visible = $false
        $excelDLXG.DisplayAlerts = $false
        
        try {
            $wbDLXG = $excelDLXG.Workbooks.Open($EXCEL_FILE_PATH, 0, $true)
            $shDLXG = $wbDLXG.Sheets.Item("DL-XG")
            
            $delayDieCut = 0; $delayMolded = 0; $delayOthers = 0
            $urgentDieCut = 0; $urgentMolded = 0; $urgentOthers = 0
            
            $row = 2
            while ($true) {
                $reasonText = $shDLXG.Cells.Item($row, 2).Text
                $qtyText = $shDLXG.Cells.Item($row, 3).Text
                $typeText = $shDLXG.Cells.Item($row, 5).Text
                
                if ([string]::IsNullOrWhiteSpace($reasonText) -and [string]::IsNullOrWhiteSpace($typeText)) { break }
                
                $reason = $reasonText.Trim().ToUpper()
                $type = $typeText.Trim().ToUpper()
                
                $qty = 0
                if (-not [string]::IsNullOrWhiteSpace($qtyText)) {
                    $qtyText = $qtyText -replace '[^\d\.-]', ''
                    if ($qtyText) { [double]::TryParse($qtyText, [ref]$qty) | Out-Null }
                }
                
                if ($reason -eq "PRODUCTION DELAY") {
                    if ($type -eq "DIE CUT") { $delayDieCut += $qty }
                    elseif ($type -eq "MOLDED") { $delayMolded += $qty }
                    else { $delayOthers += $qty }
                }
                elseif ($reason -eq "URGENT") {
                    if ($type -eq "DIE CUT") { $urgentDieCut += $qty }
                    elseif ($type -eq "MOLDED") { $urgentMolded += $qty }
                    else { $urgentOthers += $qty }
                }
                
                $row++
                if ($row -gt 50000) { break }
            }
            
            $wbDLXG.Close($false)
            $excelDLXG.Quit()
            [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excelDLXG) | Out-Null
            $excelDLXG = $null
            
            $delayTotal = $delayDieCut + $delayMolded + $delayOthers
            $urgentTotal = $urgentDieCut + $urgentMolded + $urgentOthers
            
            $delayDieCutF = "{0:N0}" -f $delayDieCut
            $delayMoldedF = "{0:N0}" -f $delayMolded
            $delayOthersF = "{0:N0}" -f $delayOthers
            $delayTotalF  = "{0:N0}" -f $delayTotal
            
            $urgentDieCutF = "{0:N0}" -f $urgentDieCut
            $urgentMoldedF = "{0:N0}" -f $urgentMolded
            $urgentOthersF = "{0:N0}" -f $urgentOthers
            $urgentTotalF  = "{0:N0}" -f $urgentTotal
            
            $currentTimeStr = Get-Date -Format "HH:mm dd/MM/yy"
            
            $dlMessage = "Thông tin Delay xuất gấp đến thời điểm ${currentTimeStr}:`nDelay: Die cut: $delayDieCutF Pairs, Molded: $delayMoldedF Pairs, Others: $delayOthersF Pairs, Total: $delayTotalF Pairs.`nXuất gấp: Die cut: $urgentDieCutF Pairs, Molded: $urgentMoldedF Pairs, Others: $urgentOthersF Pairs, Total: $urgentTotalF Pairs."
            
            Write-Host "Noi dung bao cao Delay Xuat Gap:"
            Write-Host $dlMessage -ForegroundColor Green
            
            Focus-Zalo
            Start-Sleep -Seconds 1
            
            [System.Windows.Forms.SendKeys]::SendWait("^f")
            Start-Sleep -Milliseconds 800
            [System.Windows.Forms.Clipboard]::SetText($ZALO_TARGET_NAME, [System.Windows.Forms.TextDataFormat]::UnicodeText)
            [System.Windows.Forms.SendKeys]::SendWait("^v")
            Start-Sleep -Seconds 2
            [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
            Start-Sleep -Seconds 2

            [System.Windows.Forms.Clipboard]::SetText($dlMessage, [System.Windows.Forms.TextDataFormat]::UnicodeText)
            [System.Windows.Forms.SendKeys]::SendWait("^v")
            Start-Sleep -Milliseconds 600
            [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
            Start-Sleep -Seconds 1
            
        } catch {
            Write-Host "Loi khi tao bao cao Delay Xuat Gap: $_" -ForegroundColor Red
            if ($excelDLXG) { try { $excelDLXG.Quit(); [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excelDLXG) | Out-Null } catch {} }
        }
    }

    if ($runWip) {
        Write-Host "Bat dau doc va gui bao cao WIP..." -ForegroundColor Cyan
        $WIP_EXCEL_PATH = "C:\Users\prod.public\Ortholite Vietnam\OVN Production - Documents\PRODUCTION\Nhân Lg\Schedule\Ovn Pro Schedule.xlsb"
        if (Test-Path $WIP_EXCEL_PATH) {
            $excelWIP = New-Object -ComObject Excel.Application
            $excelWIP.Visible = $false
            $excelWIP.DisplayAlerts = $false
            try {
                $wbWIP = $excelWIP.Workbooks.Open($WIP_EXCEL_PATH, 0, $true)
                $shWIP = $wbWIP.Sheets.Item("Record Wip")
                
                $lastRow = $shWIP.Cells.Item($shWIP.Rows.Count, 1).End(-4162).Row; if ($lastRow -lt 1) { $lastRow = 1 }
                
                $colNames = @($shWIP.Cells.Item(1,2).Text.Trim(), $shWIP.Cells.Item(1,3).Text.Trim(), $shWIP.Cells.Item(1,4).Text.Trim(), $shWIP.Cells.Item(1,5).Text.Trim(), $shWIP.Cells.Item(1,6).Text.Trim(), $shWIP.Cells.Item(1,7).Text.Trim(), $shWIP.Cells.Item(1,8).Text.Trim())
                
                $wipValues = @()
                for ($c = 2; $c -le 8; $c++) {
                    $valText = $shWIP.Cells.Item($lastRow, $c).Text
                    $valNum = 0
                    if (-not [string]::IsNullOrWhiteSpace($valText)) {
                        $valText = $valText -replace '[^\d\.-]', ''
                        if ($valText) { [double]::TryParse($valText, [ref]$valNum) | Out-Null }
                    }
                    $wipValues += $valNum
                }
                
                $wbWIP.Close($false)
                $excelWIP.Quit()
                [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excelWIP) | Out-Null
                $excelWIP = $null
                
                $lamination = $wipValues[0] + $wipValues[1]
                $prefitting = $wipValues[2]
                $molding = $wipValues[3]
                $leanMolded = $wipValues[4] + ($wipValues[5] * 0.6) + $wipValues[6]
                $leanDc = $wipValues[5] * 0.4
                $totalActual = $lamination + $prefitting + $molding + $leanMolded + $leanDc
                
                function Get-WipSectionText($name, $actual, $target) {
                    $diff = $actual - $target
                    $fmtActual = "{0:N0}" -f $actual
                    $fmtDiff = "{0:N0}" -f [math]::Abs($diff)
                    $fmtTarget = "{0:N0}" -f $target
                    if ($diff -gt 0) { return "$($name) (Target $fmtTarget): $fmtActual Pairs (Vượt $fmtDiff Pairs so với Target)`n" }
                    elseif ($diff -lt 0) { return "$($name) (Target $fmtTarget): $fmtActual Pairs (Thấp hơn $fmtDiff Pairs so với Target)`n" }
                    else { return "$($name) (Target $fmtTarget): $fmtActual Pairs (Đạt đúng Target)`n" }
                }

                $currentTimeStr = Get-Date -Format "HH:mm dd/MM/yy"
                $wipMsg = "Báo cáo tình hình WIP đến thời điểm ${currentTimeStr}:`n"
                $wipMsg += Get-WipSectionText "1. LAMINATION" $lamination 670000
                $wipMsg += Get-WipSectionText "2. PREFITTING" $prefitting 250000
                $wipMsg += Get-WipSectionText "3. MOLDING" $molding 260000
                $wipMsg += Get-WipSectionText "4. LEANLINE MOLDED" $leanMolded 500000
                $wipMsg += Get-WipSectionText "5. LEANLINE DC" $leanDc 220000
                
                $totalActualF = "{0:N0}" -f $totalActual
                $wipMsg += "Total WIP (1->5): $totalActualF Pairs`n"
                
                $targetTotal = 1900000
                if ($totalActual -gt $targetTotal) {
                    $diff = "{0:N0}" -f ($totalActual - $targetTotal)
                    $wipMsg += "Nhận xét: Tổng WIP (1->5) hiện tại đang VƯỢT target $diff Pairs. Cần chú ý giảm WIP!"
                } elseif ($totalActual -lt $targetTotal) {
                    $diff = "{0:N0}" -f ($targetTotal - $totalActual)
                    $wipMsg += "Nhận xét: Tổng WIP (1->5) hiện tại đang THẤP HƠN target $diff Pairs. Đang kiểm soát tốt!"
                } else {
                    $wipMsg += "Nhận xét: Tổng WIP (1->5) hiện tại ĐẠT ĐÚNG target 1,900,000 Pairs."
                }
                
                Write-Host "Noi dung bao cao WIP:"
                Write-Host $wipMsg -ForegroundColor Green
                
                Focus-Zalo
                Start-Sleep -Seconds 1
                
                [System.Windows.Forms.SendKeys]::SendWait("^f")
                Start-Sleep -Milliseconds 800
                [System.Windows.Forms.Clipboard]::SetText($ZALO_TARGET_NAME, [System.Windows.Forms.TextDataFormat]::UnicodeText)
                [System.Windows.Forms.SendKeys]::SendWait("^v")
                Start-Sleep -Seconds 2
                [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
                Start-Sleep -Seconds 2

                [System.Windows.Forms.Clipboard]::SetText($wipMsg, [System.Windows.Forms.TextDataFormat]::UnicodeText)
                [System.Windows.Forms.SendKeys]::SendWait("^v")
                Start-Sleep -Milliseconds 600
                [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
                Start-Sleep -Seconds 1
                
            } catch {
                Write-Host "Loi khi tao bao cao WIP: $_" -ForegroundColor Red
                if ($excelWIP) { try { $excelWIP.Quit(); [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excelWIP) | Out-Null } catch {} }
            }
        }
    }

    Write-Host "=== HOAN TAT GUI BAO CAO ===" -ForegroundColor Green
} catch {
    Write-Host "LOI: $_" -ForegroundColor Red
    if ($excel) { try { $excel.Quit(); [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null } catch {} }
    exit 1
}
