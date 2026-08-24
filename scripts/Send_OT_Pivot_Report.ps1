# scripts/Send_OT_Pivot_Report.ps1
param(
    [string]$Action = "Full" # Co the truyen "Refresh", "Send", hoac "Full"
)

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

$excelPath = "c:\Users\prod.public\Ortholite Vietnam\OVN Production - Documents\PRODUCTION\TRUONG OFFICE\PROJECT\KPI APP\APP KPI\% OT.xlsx"
$imgPath = "c:\Users\prod.public\Ortholite Vietnam\OVN Production - Documents\PRODUCTION\TRUONG OFFICE\PROJECT\KPI APP\APP KPI\scratch\ot_pivot_report.png"

$excel = $null
$wb = $null

try {
    Write-LogOT "Dang tim ket noi den ung dung Excel dang mo..."
    $excel = [System.Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
    Write-LogOT "Da ket noi thanh cong voi Excel dang chay (GetActiveObject)."
} catch {
    Write-LogOT "Khong tim thay tien trinh Excel nao dang mo. Se khoi tao tien trinh moi..."
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $true
}

try {
    foreach ($w in $excel.Workbooks) {
        if ($w.FullName -eq $excelPath -or $w.Name -match "% OT") {
            $wb = $w
            Write-LogOT "Da tim thay workbook % OT.xlsx dang duoc mo."
            break
        }
    }
} catch {}

if (-not $wb) {
    Write-LogOT "Chua mo file % OT.xlsx. Dang tien hanh mo file..."
    if (Test-Path $excelPath) {
        $wb = $excel.Workbooks.Open($excelPath)
    } else {
        Write-LogOT "Khong tim thay duong dan file: $excelPath" "ERROR"
        exit 1
    }
}

try {
    if ($Action -eq "Refresh" -or $Action -eq "Full") {
        Write-LogOT "Dang thuc hien lenh REFRESH du lieu..."
        try {
            $shControl = $wb.Sheets.Item("ControlManhour5")
            foreach ($lo in $shControl.ListObjects) {
                try { $lo.QueryTable.Refresh($false) } catch {}
            }
        } catch {}
        
        $wb.RefreshAll()
        Write-LogOT "Da goi lenh RefreshAll()."
    }

    if ($Action -eq "Send" -or $Action -eq "Full") {
        Write-LogOT "Dang cap nhat PivotTable1 tai Sheet2 va chup anh..."
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
        
        # Goi script Zalo
        if (Test-Path $imgPath) {
            Write-LogOT "Kich hoat Zalo_Send_Image.bat de gui anh vao Zalo..."
            $zaloBat = Join-Path $PSScriptRoot "Zalo_Send_Image.bat"
            $proc = Start-Process -FilePath $zaloBat -WindowStyle Normal -PassThru
            $proc.WaitForExit(120000)
            if ($proc.ExitCode -eq 0) {
                Write-LogOT "DA GUI ANH BAO CAO % OT PIVOT TABLE VAO ZALO THANH CONG!"
            } else {
                Write-LogOT "Zalo_Send_Image ket thuc voi exit code: $($proc.ExitCode)" "WARN"
            }
        } else {
            Write-LogOT "Khong tim thay file anh: $imgPath" "ERROR"
        }
    }
} catch {
    Write-LogOT "Co loi xay ra trong qua trinh $Action : $_" "ERROR"
} finally {
    # Khong the Quit Excel hoac Close file, vi muc dich la de treo!
    if ($excel) {
        try { [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null } catch {}
    }
}
