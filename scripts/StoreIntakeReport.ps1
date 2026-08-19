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
$runEmployeesVoice = ($TargetReport -eq "employees_voice") -or (-not $ManualTrigger -and (Get-Date).Hour -eq 8)

if (-not $runDaily -and -not $runHangBu -and -not $runDelay -and -not $runWip -and -not $runEmployeesVoice) {
    Write-Host "Khong co bao cao nao duoc kich hoat. Thoat." -ForegroundColor Yellow
    exit 0
}

$ORIGINAL_EXCEL_FILE_PATH = "C:\Users\prod.public\Ortholite Vietnam\OVN Production - Documents\PRODUCTION\TRUONG OFFICE\PROJECT\Dashboard Progress tracking\data\Powerapp (V21.10.25).xlsx"
if (-not (Test-Path $ORIGINAL_EXCEL_FILE_PATH)) {
    $ORIGINAL_EXCEL_FILE_PATH = "$env:USERPROFILE\Ortholite Vietnam\OVN Production - Documents\PRODUCTION\TRUONG OFFICE\PROJECT\Dashboard Progress tracking\data\Powerapp (V21.10.25).xlsx"
}
$EXCEL_FILE_PATH = "$env:TEMP\Powerapp_Temp_Report.xlsx"
if (Test-Path $ORIGINAL_EXCEL_FILE_PATH) {
    Copy-Item -Path $ORIGINAL_EXCEL_FILE_PATH -Destination $EXCEL_FILE_PATH -Force
}
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
    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)] public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
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
        $zaloProcess = Get-Process -Name Zalo -ErrorAction SilentlyContinue | Select-Object -First 1
    }
    if (-not $zaloProcess) {
        throw "Hay mo Zalo PC truoc khi chay script!"
    }
    $script:zaloHandle = $zaloProcess.MainWindowHandle
    if ($script:zaloHandle -eq [IntPtr]::Zero) {
        $script:zaloHandle = [WinHelper]::FindWindow($null, "Zalo")
    }

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
        
        $prodDir = "C:\Users\prod.public\Ortholite Vietnam\OVN Production - Documents\PRODUCTION"
        if (-not (Test-Path $prodDir)) {
            $prodDir = "$env:USERPROFILE\Ortholite Vietnam\OVN Production - Documents\PRODUCTION"
        }
        $SUPP_EXCEL_PATH = $null
        if (Test-Path $prodDir) {
            $hienFolder = Get-ChildItem -Path $prodDir -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "*Hi*" } | Select-Object -First 1
            if ($hienFolder) {
                $foundFile = Get-ChildItem -Path $hienFolder.FullName -Filter "*.xlsx" -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "*Report*supp*2026*" } | Select-Object -First 1
                if ($foundFile) {
                    $SUPP_EXCEL_PATH = $foundFile.FullName
                }
            }
        }
        if (-not $SUPP_EXCEL_PATH) {
            $SUPP_EXCEL_PATH = "C:\Users\prod.public\Ortholite Vietnam\OVN Production - Documents\PRODUCTION\Hiền\Report Lỗi thao tác supp 2026.xlsx"
        }

        $SUPP_TEMP_PATH = "$env:TEMP\Supp_Temp_Report.xlsx"
        if (Test-Path $SUPP_EXCEL_PATH) {
            try { Copy-Item -Path $SUPP_EXCEL_PATH -Destination $SUPP_TEMP_PATH -Force } catch {}
        }
        $targetOpenPath = if (Test-Path $SUPP_TEMP_PATH) { $SUPP_TEMP_PATH } else { $SUPP_EXCEL_PATH }

        if (-not (Test-Path $targetOpenPath)) {
            Write-Host "Khong tim thay file Excel hang bu: $SUPP_EXCEL_PATH" -ForegroundColor Red
        } else {
            $excelSupp = New-Object -ComObject Excel.Application
            $excelSupp.Visible = $false
            $excelSupp.DisplayAlerts = $false
            
            try {
                $wbSupp = $excelSupp.Workbooks.Open($targetOpenPath, 0, $true)
                $shSupp = $null
                try { $shSupp = $wbSupp.Sheets.Item("2026") } catch {}
                if (-not $shSupp) { try { $shSupp = $wbSupp.Sheets.Item("DATA SUPPLEMENT") } catch {} }
                
                if (-not $shSupp) {
                    Write-Host "Khong tim thay sheet 2026 hoac DATA SUPPLEMENT!" -ForegroundColor Red
                } else {
                    $startCol = 2
                    $rowSuppPro = 52
                    $rowSuppTotal = 53
                    
                    $lastCol = $startCol
                    while ($true) {
                        $nextColValue = $shSupp.Cells.Item($rowSuppPro, $lastCol + 1).Text
                        if ([string]::IsNullOrWhiteSpace($nextColValue)) { break }
                        $lastCol++
                    }
                    
                    $suppProValue = $shSupp.Cells.Item($rowSuppPro, $lastCol).Text
                    $suppTotalValue = $shSupp.Cells.Item($rowSuppTotal, $lastCol).Text
                    
                    # Doc sheet top mold cho top 3 khuon bu nhieu nhat
                    $topMoldText = ""
                    $shTop = $null
                    try { $shTop = $wbSupp.Sheets.Item("top mold") } catch {}
                    if ($shTop) {
                        $headerRow = 5
                        $col = 2
                        $lastDateCol = $col
                        while ($true) {
                            $hText = $shTop.Cells.Item($headerRow, $col).Text.Trim()
                            if ($hText -eq "Grand Total" -or [string]::IsNullOrWhiteSpace($hText)) {
                                $lastDateCol = [Math]::Max(2, $col - 1)
                                break
                            }
                            $col++
                        }
                        
                        $molds = @()
                        $r = 6
                        while ($true) {
                            $moldName = $shTop.Cells.Item($r, 1).Text.Trim()
                            if ($moldName -eq "Grand Total" -or [string]::IsNullOrWhiteSpace($moldName)) {
                                break
                            }
                            $qtyText = $shTop.Cells.Item($r, $lastDateCol).Text.Trim()
                            if (-not [string]::IsNullOrWhiteSpace($qtyText)) {
                                $cleanQty = $qtyText -replace '[^\d]', ''
                                $qty = 0
                                if ([double]::TryParse($cleanQty, [ref]$qty) -and $qty -gt 0) {
                                    $molds += [PSCustomObject]@{
                                        Mold = $moldName
                                        Qty = $qty
                                    }
                                }
                            }
                            $r++
                        }
                        
                        $top3 = $molds | Sort-Object Qty -Descending | Select-Object -First 3
                        $top3Array = @($top3)
                        if ($top3Array.Count -gt 0) {
                            $topMoldLines = @()
                            $rank = 1
                            foreach ($m in $top3Array) {
                                $formattedQty = "{0:N0}" -f $m.Qty
                                $topMoldLines += "$rank. $($m.Mold): $formattedQty đôi"
                                $rank++
                            }
                            $headerTitle = if ($top3Array.Count -ge 3) { "Top 3 khuôn bù nhiều nhất:" } else { "Top khuôn bù nhiều nhất ($($top3Array.Count) khuôn):" }
                            $topMoldText = "`n$headerTitle`n" + ($topMoldLines -join "`n")
                        } else {
                            $topMoldText = "`nTop khuôn bù nhiều nhất: Không có phát sinh"
                        }
                    }
                    
                    $wbSupp.Close($false)
                    $excelSupp.Quit()
                    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excelSupp) | Out-Null
                    $excelSupp = $null
                    
                    $yesterday = (Get-Date).AddDays(-1).ToString("dd/MM/yy")
                    $suppMessage = "Thông tin hàng bù đến ngày hôm qua $yesterday.`n% hàng bù thao tác sản xuất: $suppProValue;`nTổng % hàng bù: $suppTotalValue$topMoldText"
                    
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
                $shWIP = $null
                try { $shWIP = $wbWIP.Sheets.Item("Record Wip (Old)") } catch {}
                if (-not $shWIP) {
                    try { $shWIP = $wbWIP.Sheets.Item("Record Wip") } catch {}
                }
                
                # Luôn lấy data dòng thứ 2 (dữ liệu realtime hiện tại)
                $wipRow = 2
                
                $colNames = @($shWIP.Cells.Item(1,2).Text.Trim(), $shWIP.Cells.Item(1,3).Text.Trim(), $shWIP.Cells.Item(1,4).Text.Trim(), $shWIP.Cells.Item(1,5).Text.Trim(), $shWIP.Cells.Item(1,6).Text.Trim(), $shWIP.Cells.Item(1,7).Text.Trim(), $shWIP.Cells.Item(1,8).Text.Trim())
                
                $wipValues = @()
                for ($c = 2; $c -le 8; $c++) {
                    $valText = $shWIP.Cells.Item($wipRow, $c).Text
                    $valNum = 0
                    if (-not [string]::IsNullOrWhiteSpace($valText)) {
                        $valText = $valText -replace '[^\d\.-]', ''
                        if ($valText) { [double]::TryParse($valText, [ref]$valNum) | Out-Null }
                    }
                    $wipValues += $valNum
                }
                
                # Đọc dữ liệu từ sheet RECORD WIP cho báo cáo WIP NEW TARGET
                $shRecordWip = $null
                try { $shRecordWip = $wbWIP.Sheets.Item("RECORD WIP") } catch {}
                if (-not $shRecordWip) {
                    try { $shRecordWip = $wbWIP.Sheets.Item("Record Wip") } catch {}
                }
                
                $laminationNew = 0
                $leanDcNew = 0
                $prefittingNew = 0
                $moldingNew = 0
                $leanMoldedNew = 0

                if ($shRecordWip) {
                    # Format mới (ngang: Row 1 Header, Row 4 Ghi chú, Row 2 Giá trị các cột)
                    for ($c = 1; $c -le 10; $c++) {
                        $secName = ($shRecordWip.Cells.Item(1, $c).Text + " " + $shRecordWip.Cells.Item(4, $c).Text).Trim()
                        $valText = $shRecordWip.Cells.Item(2, $c).Text
                        $valNum = 0
                        if (-not [string]::IsNullOrWhiteSpace($valText)) {
                            $valText = $valText -replace '[^\d\.-]', ''
                            if ($valText) { [double]::TryParse($valText, [ref]$valNum) | Out-Null }
                        }
                        
                        if ($secName -like "*1.MATERIAL*" -or $secName -like "*LAMINATION*") {
                            $laminationNew = $valNum
                        } elseif ($secName -like "*2.WIP*" -or $secName -like "*DIE CUT*" -or $secName -like "*Leanline DC*") {
                            $leanDcNew = $valNum
                        } elseif ($secName -like "*3.WIP*" -or $secName -like "*PREFITTING*" -or $secName -like "*Prefitting*") {
                            $prefittingNew = $valNum
                        } elseif ($secName -like "*4.WIP*" -or ($secName -like "*MOLDING*" -and $secName -notlike "*LEAN*")) {
                            $moldingNew = $valNum
                        } elseif ($secName -like "*5.WIP*" -or $secName -like "*LEAN LINE MOLDED*" -or $secName -like "*Leanline Molded*") {
                            $leanMoldedNew = $valNum
                        }
                    }

                    # Fallback nếu format cũ (dọc: Row 2->10, Col 1 = Name, Col 2 = Value)
                    if ($laminationNew -eq 0 -and $leanDcNew -eq 0 -and $prefittingNew -eq 0 -and $moldingNew -eq 0 -and $leanMoldedNew -eq 0) {
                        for ($r = 2; $r -le 10; $r++) {
                            $secName = $shRecordWip.Cells.Item($r, 1).Text
                            $valText = $shRecordWip.Cells.Item($r, 2).Text
                            $valNum = 0
                            if (-not [string]::IsNullOrWhiteSpace($valText)) {
                                $valText = $valText -replace '[^\d\.-]', ''
                                if ($valText) { [double]::TryParse($valText, [ref]$valNum) | Out-Null }
                            }
                            
                            if ($secName -like "*1.MATERIAL*" -or $secName -like "*LAMINATION*") {
                                $laminationNew = $valNum
                            } elseif ($secName -like "*2.WIP*" -or $secName -like "*DIE CUT*") {
                                $leanDcNew = $valNum
                            } elseif ($secName -like "*3.WIP*" -or $secName -like "*PREFITTING*") {
                                $prefittingNew = $valNum
                            } elseif ($secName -like "*4.WIP*" -or ($secName -like "*MOLDING*" -and $secName -notlike "*LEAN LINE*")) {
                                $moldingNew = $valNum
                            } elseif ($secName -like "*5.WIP*" -or $secName -like "*LEAN LINE MOLDED*") {
                                $leanMoldedNew = $valNum
                            }
                        }
                    }
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
                
                # Tạo tin nhắn báo cáo WIP NEW TARGET
                $wipNewMsg = "Báo cáo tình hình WIP NEW TARGET đến thời điểm ${currentTimeStr}:`n"
                $wipNewMsg += Get-WipSectionText "1. Lamination" $laminationNew 450000
                $wipNewMsg += Get-WipSectionText "2. Prefitting" $prefittingNew 200000
                $wipNewMsg += Get-WipSectionText "3. Molding" $moldingNew 400000
                $wipNewMsg += Get-WipSectionText "4. Leanline DC" $leanDcNew 300000
                $wipNewMsg += Get-WipSectionText "5. Leanline Molded" $leanMoldedNew 550000
                
                $totalActualNew = $laminationNew + $prefittingNew + $moldingNew + $leanDcNew + $leanMoldedNew
                $totalActualNewF = "{0:N0}" -f $totalActualNew
                $wipNewMsg += "Total WIP (1->5): $totalActualNewF Pairs`n"
                
                $targetTotalNew = 1900000
                if ($totalActualNew -gt $targetTotalNew) {
                    $diffNew = "{0:N0}" -f ($totalActualNew - $targetTotalNew)
                    $wipNewMsg += "Nhận xét: Tổng WIP (1->5) hiện tại đang VƯỢT target $diffNew Pairs. Cần chú ý giảm WIP!"
                } elseif ($totalActualNew -lt $targetTotalNew) {
                    $diffNew = "{0:N0}" -f ($targetTotalNew - $totalActualNew)
                    $wipNewMsg += "Nhận xét: Tổng WIP (1->5) hiện tại đang THẤP HƠN target $diffNew Pairs. Đang kiểm soát tốt!"
                } else {
                    $wipNewMsg += "Nhận xét: Tổng WIP (1->5) hiện tại ĐẠT ĐÚNG target 1,900,000 Pairs."
                }

                Write-Host "Noi dung bao cao WIP:"
                Write-Host $wipMsg -ForegroundColor Green
                Write-Host "Noi dung bao cao WIP NEW TARGET:"
                Write-Host $wipNewMsg -ForegroundColor Cyan
                
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
                Start-Sleep -Seconds 2

                [System.Windows.Forms.Clipboard]::SetText($wipNewMsg, [System.Windows.Forms.TextDataFormat]::UnicodeText)
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
    if ($runEmployeesVoice) {
        Write-Host "Bat dau doc va gui bao cao Employees Voice..." -ForegroundColor Cyan
        
        $VOICE_EXCEL_PATH = "C:\Users\prod.public\Ortholite Vietnam\OVN Production - Documents\PRODUCTION\TRUONG OFFICE\Tiếng Nói Từ Hiện Trường Sản Xuất.xlsx"
        if (-not (Test-Path $VOICE_EXCEL_PATH)) {
            Write-Host "Khong tim thay file Excel: $VOICE_EXCEL_PATH" -ForegroundColor Red
        } else {
            $excelVoice = $null
            $wbVoice = $null
            $wasOpenedByUs = $false
            $isExcelCreatedByUs = $false
            
            try {
                $excelVoice = [System.Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
                Write-Host "Da ket noi voi Excel dang chay." -ForegroundColor Cyan
            } catch {
                $excelVoice = New-Object -ComObject Excel.Application
                $isExcelCreatedByUs = $true
                Write-Host "Da mo Excel moi." -ForegroundColor Cyan
            }
            
            try {
                foreach ($wb in $excelVoice.Workbooks) {
                    if ($wb.FullName -eq $VOICE_EXCEL_PATH) {
                        $wbVoice = $wb
                        break
                    }
                }
                
                if (-not $wbVoice) {
                    $wbVoice = $excelVoice.Workbooks.Open($VOICE_EXCEL_PATH, 0, $true)
                    $wasOpenedByUs = $true
                }
                
                $shVoice = $wbVoice.Sheets.Item(1)
                $lastRow = $shVoice.Cells.Item($shVoice.Rows.Count, 1).End(-4162).Row
                if ($lastRow -lt 2) { $lastRow = 1 }
                
                $allRows = @()
                for ($i = 2; $i -le $lastRow; $i++) {
                    $timeStr = $shVoice.Cells.Item($i, 2).Text
                    $section = $shVoice.Cells.Item($i, 6).Text
                    $opinion = $shVoice.Cells.Item($i, 7).Text
                    
                    if (-not [string]::IsNullOrWhiteSpace($opinion)) {
                        $parsedDate = Get-Date
                        if ([DateTime]::TryParse($timeStr, [ref]$parsedDate)) {
                            $allRows += [PSCustomObject]@{
                                Date = $parsedDate.Date
                                DateStr = $parsedDate.ToString("dd/MM")
                                Section = $section.Trim()
                                Opinion = $opinion.Trim()
                            }
                        }
                    }
                }
                
                if ($allRows.Count -gt 0) {
                    $maxDate = ($allRows | Measure-Object -Property Date -Maximum).Maximum
                    $currentDate = Get-Date
                    $isFriday = ($currentDate.DayOfWeek -eq [System.DayOfWeek]::Friday)
                    
                    if ($isFriday) {
                        $diff = (1 - [int]$maxDate.DayOfWeek)
                        if ($diff -gt 0) { $diff -= 7 }
                        $startDate = $maxDate.AddDays($diff)
                        
                        $filteredRows = $allRows | Where-Object { $_.Date -ge $startDate -and $_.Date -le $maxDate }
                        $reportTitle = "[BÁO CÁO TUẦN] TIẾNG NÓI TỪ HIỆN TRƯỜNG SẢN XUẤT 🗣`n📅 Thời gian: $($startDate.ToString('dd/MM/yyyy')) - $($maxDate.ToString('dd/MM/yyyy'))"
                    } else {
                        $filteredRows = $allRows | Where-Object { $_.Date -eq $maxDate }
                        $reportTitle = "[BÁO CÁO NGÀY] TIẾNG NÓI TỪ HIỆN TRƯỜNG SẢN XUẤT 🗣`n📅 Ngày ghi nhận: $($maxDate.ToString('dd/MM/yyyy'))"
                    }
                    
                    if ($filteredRows.Count -gt 0) {
                        $grouped = $filteredRows | Group-Object -Property Section
                        $msg = $reportTitle + "`n`n"
                        foreach ($group in $grouped) {
                            $sectionName = $group.Name
                            if ([string]::IsNullOrWhiteSpace($sectionName)) { $sectionName = "KHU VỰC KHÁC" }
                            
                            $msg += "🏢 $($sectionName):`n"
                            $idx = 1
                            foreach ($row in $group.Group) {
                                if ($isFriday) {
                                    $msg += "$idx. $($row.Opinion) ($($row.DateStr))`n"
                                } else {
                                    $msg += "$idx. $($row.Opinion)`n"
                                }
                                $idx++
                            }
                            $msg += "`n"
                        }
                        
                        if ($isFriday) {
                            $msg += "---------------------------------`nBan quản lý đã ghi nhận các ý kiến trong tuần. Cảm ơn sự đóng góp của các bạn!"
                        } else {
                            $msg += "---------------------------------`nMọi ý kiến đã được ghi nhận. Cảm ơn sự đóng góp của các bạn!"
                        }
                        
                        Write-Host "Noi dung bao cao Employees Voice:"
                        Write-Host $msg -ForegroundColor Green
                        
                        $TARGET_ZALO_GROUP = "Employees voice"
                        Focus-Zalo
                        Start-Sleep -Seconds 1
                        
                        [System.Windows.Forms.SendKeys]::SendWait("^f")
                        Start-Sleep -Milliseconds 800
                        [System.Windows.Forms.Clipboard]::SetText($TARGET_ZALO_GROUP, [System.Windows.Forms.TextDataFormat]::UnicodeText)
                        [System.Windows.Forms.SendKeys]::SendWait("^v")
                        Start-Sleep -Seconds 2
                        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
                        Start-Sleep -Seconds 2
                        
                        [System.Windows.Forms.Clipboard]::SetText($msg, [System.Windows.Forms.TextDataFormat]::UnicodeText)
                        [System.Windows.Forms.SendKeys]::SendWait("^v")
                        Start-Sleep -Milliseconds 600
                        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
                        Start-Sleep -Seconds 1
                    } else {
                        Write-Host "Khong co du lieu nao trong khoang thoi gian nay." -ForegroundColor Yellow
                    }
                } else {
                    Write-Host "File Excel khong co du lieu hop le." -ForegroundColor Yellow
                }
            } catch {
                Write-Host "Loi khi doc hoac gui bao cao Employees Voice: $_" -ForegroundColor Red
            } finally {
                if ($wasOpenedByUs -and $wbVoice) {
                    try { $wbVoice.Close($false) } catch {}
                }
                if ($isExcelCreatedByUs -and $excelVoice) {
                    try { $excelVoice.Quit(); [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excelVoice) | Out-Null } catch {}
                } elseif ($excelVoice) {
                    try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excelVoice) | Out-Null } catch {}
                }
            }
        }
    }

    Write-Host "=== HOAN TAT GUI BAO CAO ===" -ForegroundColor Green
} catch {
    Write-Host "LOI: $_" -ForegroundColor Red
    if ($excel) { try { $excel.Quit(); [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null } catch {} }
    exit 1
}

finally {
    & (Join-Path $PSScriptRoot "Cleanup-Excel.ps1")
}
