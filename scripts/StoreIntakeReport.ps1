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

    # Láº¥y dá»¯ liá»‡u vÃ  loáº¡i bá» khoáº£ng tráº¯ng hoáº·c text dÆ° thá»«a náº¿u cÃ³ (Ä‘á» phÃ²ng)
    $molded = $sheet.Range("B2").Text
    $dieCut = $sheet.Range("B3").Text
    $others = $sheet.Range("B4").Text
    $total  = $sheet.Range("B5").Text

    $workbook.Close($false)
    $excel.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null

    # Dá»n dáº¹p Text trÃ¡nh trÃ¹ng láº·p chá»¯ "Pairs" náº¿u trong Ã´ Excel Ä‘Ã£ cÃ³ sáºµn
    if ($molded -match "Pairs") { $molded = $molded -replace "(?i)\s*Pairs\s*", "" }
    if ($dieCut -match "Pairs") { $dieCut = $dieCut -replace "(?i)\s*Pairs\s*", "" }
    if ($others -match "Pairs") { $others = $others -replace "(?i)\s*Pairs\s*", "" }
    if ($total -match "Pairs")  { $total  = $total -replace "(?i)\s*Pairs\s*", "" }

    # Format Message
    $currentTime = Get-Date -Format "HH:mm dd/MM/yy"
    $reportMessage = "Tá»•ng sá»‘ lÆ°á»£ng nháº­p kho Ä‘áº¿n hiá»‡n táº¡i ($currentTime)`nMolded: $molded Pairs`nDie Cut: $dieCut Pairs`nOthers: $others Pairs`nTotal: $total Pairs"

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
        
        $SUPP_EXCEL_PATH = "C:\Users\prod.public\Ortholite Vietnam\OVN Production - Documents\PRODUCTION\Hiá»n\Report Lá»—i thao tÃ¡c supp 2026.xlsx"
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
                    $suppMessage = "ThÃ´ng tin hÃ ng bÃ¹ Ä‘áº¿n ngÃ y hÃ´m qua $yesterday.`n% hÃ ng bÃ¹ thao tÃ¡c sáº£n xuáº¥t: $suppProValue;`nTá»•ng % hÃ ng bÃ¹: $suppTotalValue"
                    
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
