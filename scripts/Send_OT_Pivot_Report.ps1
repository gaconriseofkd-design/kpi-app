# scripts/Send_OT_Pivot_Report.ps1
# Tự động refresh % OT.xlsx, lấy ảnh PivotTable1 ở Sheet2 và gửi vào Zalo group Daily Report

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$win32Src = @"
using System;
using System.Runtime.InteropServices;
public class WinHelperOT {
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmd);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
    [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
}
"@
Add-Type -TypeDefinition $win32Src -Language CSharp -ErrorAction SilentlyContinue

function Write-LogOT([string]$msg, [string]$level = "INFO") {
    $timeStr = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMsg = "[$timeStr] [$level] $msg"
    Write-Host $logMsg
}

# 1. Kill TOAN BO Excel truoc khi bat dau (tranh RPC_E_CALL_REJECTED)
Write-LogOT "Dong toan bo process Excel cu..."
Get-Process Excel -ErrorAction SilentlyContinue | ForEach-Object {
    try { Stop-Process -Id $_.Id -Force } catch {}
}
Start-Sleep -Seconds 3  # Doi Excel giai phong COM

$excelPath = "c:\Users\prod.public\Ortholite Vietnam\OVN Production - Documents\PRODUCTION\TRUONG OFFICE\PROJECT\KPI APP\APP KPI\% OT.xlsx"
$imgPath = "c:\Users\prod.public\Ortholite Vietnam\OVN Production - Documents\PRODUCTION\TRUONG OFFICE\PROJECT\KPI APP\APP KPI\scratch\ot_pivot_report.png"

if (-not (Test-Path $excelPath)) {
    Write-LogOT "Khong tim thay file % OT.xlsx tai: $excelPath" "ERROR"
    exit 1
}

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
Start-Sleep -Seconds 2  # Doi Excel.Application khoi dong on dinh

try {
    Write-LogOT "Mo file Excel % OT.xlsx..."
    $wb = $excel.Workbooks.Open($excelPath)
    
    Write-LogOT "Dang refresh du lieu sheet ControlManhour5 va toan bo Workbook..."
    try {
        $shControl = $wb.Sheets.Item("ControlManhour5")
        foreach ($lo in $shControl.ListObjects) {
            try { $lo.QueryTable.Refresh($false) } catch {}
        }
    } catch {}
    
    $wb.RefreshAll()
    $excel.CalculateUntilAsyncQueriesDone()
    Start-Sleep -Seconds 2
    
    Write-LogOT "Dang cap nhat PivotTable1 tai Sheet2..."
    $shSheet2 = $wb.Sheets.Item("Sheet2")
    $pt1 = $shSheet2.PivotTables("PivotTable1")
    $pt1.Update()
    
    $ptRange = $pt1.TableRange2
    if (-not $ptRange) { $ptRange = $pt1.TableRange1 }
    
    Write-LogOT "Copy bang PivotTable1 duoi dang hinh anh..."
    $ptRange.CopyPicture(1, 2) # xlScreen = 1, xlBitmap = 2
    Start-Sleep -Milliseconds 600
    
    if ([System.Windows.Forms.Clipboard]::ContainsImage()) {
        $img = [System.Windows.Forms.Clipboard]::GetImage()
        $img.Save($imgPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $img.Dispose()
        Write-LogOT "Da xuat anh PivotTable1 thanh cong tai: $imgPath"
    } else {
        Write-LogOT "Thu lai phuong phap Chart Export..."
        $ptRange.Copy()
        $chartObj = $shSheet2.ChartObjects().Add($ptRange.Left, $ptRange.Top, $ptRange.Width, $ptRange.Height)
        $chartObj.Chart.Paste()
        $chartObj.Chart.Export($imgPath, "PNG")
        $chartObj.Delete()
        Write-LogOT "Da xuat anh qua Chart thanh cong!"
    }
    
    $wb.Close($false)
} catch {
    Write-LogOT "Loi cap nhat Excel/PivotTable: $_" "ERROR"
    if ($excel) { try { $excel.Quit(); [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null } catch {} }
    exit 1
} finally {
    if ($excel) {
        $excel.Quit()
        [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
    }
}

# Mo cua so PowerShell MOI CO THE NHIN THAY de tuong tac Zalo
# (Script ngam khong co quyen focus cua so desktop - can cua so rieng)
$zaloSendScript = Join-Path $PSScriptRoot "Zalo_Send_Image.ps1"

if (Test-Path $imgPath) {
    Write-LogOT "Kich hoat Zalo_Send_Image.bat de gui anh vao Zalo..."
    $zaloBat = Join-Path $PSScriptRoot "Zalo_Send_Image.bat"
    $proc = Start-Process -FilePath $zaloBat -WindowStyle Normal -PassThru
    $proc.WaitForExit(120000)  # Cho toi da 2 phut
    if ($proc.ExitCode -eq 0) {
        Write-LogOT "DA GUI ANH BAO CAO % OT PIVOT TABLE VAO ZALO THANH CONG!"
    } else {
        Write-LogOT "Zalo_Send_Image ket thuc voi exit code: $($proc.ExitCode)" "WARN"
    }
} else {
    Write-LogOT "Khong tim thay file anh: $imgPath" "ERROR"
}
