# scripts/StoreIntakeReport.ps1

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
    Write-Host "Bat dau lay du lieu Excel..." -ForegroundColor Cyan
    
    if (-not (Test-Path $EXCEL_FILE_PATH)) {
        throw "Khong tim thay file Excel tai: $EXCEL_FILE_PATH"
    }

    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false

    # Open ReadOnly
    $workbook = $excel.Workbooks.Open($EXCEL_FILE_PATH, 0, $true)
    $sheet = $workbook.Sheets.Item("REALTIME STORED")

    if (-not $sheet) {
        throw "Khong tim thay sheet 'REALTIME STORED' trong file."
    }

    # Lấy dữ liệu và loại bỏ khoảng trắng hoặc text dư thừa nếu có (đề phòng)
    $molded = $sheet.Range("B2").Text
    $dieCut = $sheet.Range("B3").Text
    $others = $sheet.Range("B4").Text
    $total  = $sheet.Range("B5").Text

    $workbook.Close($false)
    $excel.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null

    # Dọn dẹp Text tránh trùng lặp chữ "Pairs" nếu trong ô Excel đã có sẵn
    if ($molded -match "Pairs") { $molded = $molded -replace "(?i)\s*Pairs\s*", "" }
    if ($dieCut -match "Pairs") { $dieCut = $dieCut -replace "(?i)\s*Pairs\s*", "" }
    if ($others -match "Pairs") { $others = $others -replace "(?i)\s*Pairs\s*", "" }
    if ($total -match "Pairs")  { $total  = $total -replace "(?i)\s*Pairs\s*", "" }

    # Format Message
    $currentTime = Get-Date -Format "HH:mm dd/MM/yy"
    $reportMessage = "Tổng số lượng nhập kho đến hiện tại ($currentTime)`nMolded: $molded Pairs`nDie Cut: $dieCut Pairs`nOthers: $others Pairs`nTotal: $total Pairs"

    Write-Host "Noi dung bao cao:"
    Write-Host $reportMessage -ForegroundColor Green

    # --- Gui Zalo ---
    Write-Host "Dang tim Zalo PC..." -ForegroundColor Cyan
    $zaloProcess = Get-Process -Name Zalo -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle } | Select-Object -First 1
    if (-not $zaloProcess) {
        throw "Hay mo Zalo PC truoc khi chay script!"
    }
    $script:zaloHandle = $zaloProcess.MainWindowHandle

    Write-Host "Dang mo va focus Zalo..."
    Focus-Zalo
    Start-Sleep -Seconds 1

    # Tim ten nguoi nhan
    [System.Windows.Forms.SendKeys]::SendWait("^f")
    Start-Sleep -Milliseconds 800
    [System.Windows.Forms.Clipboard]::SetText($ZALO_TARGET_NAME, [System.Windows.Forms.TextDataFormat]::UnicodeText)
    [System.Windows.Forms.SendKeys]::SendWait("^v")
    Start-Sleep -Seconds 1
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Start-Sleep -Seconds 1

    # Dan va gui tin nhan
    [System.Windows.Forms.Clipboard]::SetText($reportMessage, [System.Windows.Forms.TextDataFormat]::UnicodeText)
    [System.Windows.Forms.SendKeys]::SendWait("^v")
    Start-Sleep -Milliseconds 600
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Start-Sleep -Milliseconds 800

    # --- Gui bao cao Hang Bu (chi luc 16h) ---
    if ((Get-Date).Hour -eq 16) {
        Write-Host "Kiem tra thoi gian: 16h - Bat dau doc va gui bao cao Hang Bu..." -ForegroundColor Cyan
        
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
                if (-not $shSupp) {
                    try { $shSupp = $wbSupp.Sheets.Item("DATA SUPPLEMENT") } catch {}
                }
                
                if (-not $shSupp) {
                    Write-Host "Khong tim thay sheet 2026 hoac DATA SUPPLEMENT!" -ForegroundColor Red
                } else {
                    $startCol = 2 # Column B
                    $rowSuppPro = 51
                    $rowSuppTotal = 52
                    
                    $lastCol = $startCol
                    while ($true) {
                        $nextColValue = $shSupp.Cells.Item($rowSuppPro, $lastCol + 1).Text
                        if ([string]::IsNullOrWhiteSpace($nextColValue)) {
                            break
                        }
                        $lastCol++
                    }
                    
                    $suppProValue = $shSupp.Cells.Item($rowSuppPro, $lastCol).Text
                    $suppTotalValue = $shSupp.Cells.Item($rowSuppTotal, $lastCol).Text
                    
                    $wbSupp.Close($false)
                    $excelSupp.Quit()
                    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excelSupp) | Out-Null
                    $excelSupp = $null
                    
                    # Format message
                    $yesterday = (Get-Date).AddDays(-1).ToString("dd/MM/yy")
                    $suppMessage = "Thông tin hàng bù đến ngày hôm qua $yesterday.`n% hàng bù thao tác sản xuất: $suppProValue;`nTổng % hàng bù: $suppTotalValue"
                    
                    Write-Host "Noi dung bao cao hang bu:"
                    Write-Host $suppMessage -ForegroundColor Green
                    
                    # Gui vao Zalo
                    Focus-Zalo
                    Start-Sleep -Seconds 1
                    
                    [System.Windows.Forms.SendKeys]::SendWait("^f")
                    Start-Sleep -Milliseconds 800
                    [System.Windows.Forms.Clipboard]::SetText($ZALO_TARGET_NAME, [System.Windows.Forms.TextDataFormat]::UnicodeText)
                    [System.Windows.Forms.SendKeys]::SendWait("^v")
                    Start-Sleep -Seconds 1
                    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
                    Start-Sleep -Seconds 1

                    [System.Windows.Forms.Clipboard]::SetText($suppMessage, [System.Windows.Forms.TextDataFormat]::UnicodeText)
                    [System.Windows.Forms.SendKeys]::SendWait("^v")
                    Start-Sleep -Milliseconds 600
                    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
                    Start-Sleep -Milliseconds 800
                }
            } catch {
                Write-Host "Loi khi doc file hang bu: $_" -ForegroundColor Red
                if ($excelSupp) {
                    try {
                        $excelSupp.Quit()
                        [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excelSupp) | Out-Null
                    } catch {}
                }
            }
        }
    }

    # --- Gui bao cao Delay Xuat Gap (10h va 16h) ---
    $currentHour = (Get-Date).Hour
    if ($currentHour -eq 10 -or $currentHour -eq 16) {
        Write-Host "Kiem tra thoi gian: $currentHour h - Bat dau doc va gui bao cao Delay-Xuat Gap..." -ForegroundColor Cyan
        
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
                
                if ([string]::IsNullOrWhiteSpace($reasonText) -and [string]::IsNullOrWhiteSpace($typeText)) {
                    break
                }
                
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
            
            # Gui vao Zalo
            Focus-Zalo
            Start-Sleep -Seconds 1
            
            [System.Windows.Forms.SendKeys]::SendWait("^f")
            Start-Sleep -Milliseconds 800
            [System.Windows.Forms.Clipboard]::SetText($ZALO_TARGET_NAME, [System.Windows.Forms.TextDataFormat]::UnicodeText)
            [System.Windows.Forms.SendKeys]::SendWait("^v")
            Start-Sleep -Seconds 1
            [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
            Start-Sleep -Seconds 1

            [System.Windows.Forms.Clipboard]::SetText($dlMessage, [System.Windows.Forms.TextDataFormat]::UnicodeText)
            [System.Windows.Forms.SendKeys]::SendWait("^v")
            Start-Sleep -Milliseconds 600
            [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
            Start-Sleep -Milliseconds 800
            
        } catch {
            Write-Host "Loi khi tao bao cao Delay Xuat Gap: $_" -ForegroundColor Red
            if ($excelDLXG) {
                try {
                    $excelDLXG.Quit()
                    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excelDLXG) | Out-Null
                } catch {}
            }
        }
    }

    Write-Host "=== HOAN TAT GUI BAO CAO ===" -ForegroundColor Green
} catch {
    Write-Host "LOI: $_" -ForegroundColor Red
    
    # Don dep COM Object neu co loi
    if ($excel) {
        try {
            $excel.Quit()
            [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
        } catch {}
    }
    exit 1
}
