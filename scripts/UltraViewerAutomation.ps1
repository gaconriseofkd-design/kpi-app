# ==========================================================
# ULTRAVIEWER AUTO-SEND - FIXED NULL HWND
# ==========================================================

$ZALO_GROUP_NAME = "admin-pc"
$ULTRAVIEWER_PATH = "C:\Program Files (x86)\UltraViewer\UltraViewer_Desktop.exe"

# --- KHỞI TẠO THƯ VIỆN WIN32 ---
$signature = @"
[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
[DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
[DllImport("user32.dll")] public static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);
"@
Add-Type -MemberDefinition $signature -Name "Win32Utils" -Namespace "Win32" -PassThru -ErrorAction SilentlyContinue

Add-Type -AssemblyName System.Windows.Forms

function Global-Click($x, $y) {
    [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($x, $y)
    Start-Sleep -Milliseconds 200
    [Win32.Win32Utils]::mouse_event(0x02, 0, 0, 0, 0)
    [Win32.Win32Utils]::mouse_event(0x04, 0, 0, 0, 0)
}

# --- BƯỚC 1: LẤY MẬT KHẨU ---
if (-not (Get-Process UltraViewer -ErrorAction SilentlyContinue)) {
    Start-Process $ULTRAVIEWER_PATH
    Start-Sleep -Seconds 5
}

# Tìm cửa sổ có tiêu đề "UltraViewer" để tránh lỗi Handle rỗng
$uv = Get-Process UltraViewer -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } | Select-Object -First 1

if ($uv) {
    [Win32.Win32Utils]::ShowWindow($uv.MainWindowHandle, 9)
    [Win32.Win32Utils]::SetForegroundWindow($uv.MainWindowHandle)
    Start-Sleep -Milliseconds 800
}

# Thực hiện Click và Copy (Dùng tọa độ 820, 545 của bạn)
Global-Click 820 545 
Start-Sleep -Milliseconds 500
[System.Windows.Forms.SendKeys]::SendWait("^a")
Start-Sleep -Milliseconds 300
[System.Windows.Forms.SendKeys]::SendWait("^c")
Start-Sleep -Milliseconds 800

# --- BƯỚC 2: GỬI ZALO ---
$pass = (Get-Clipboard).Trim()

if ($pass.Length -ge 4 -and $pass -notlike "*Cannot convert*") {
    $zalo = Get-Process Zalo -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle } | Select-Object -First 1
    
    if ($zalo) {
        $hWnd = $zalo.MainWindowHandle
        if ([Win32.Win32Utils]::IsIconic($hWnd)) { [Win32.Win32Utils]::ShowWindow($hWnd, 9) }
        [Win32.Win32Utils]::SetForegroundWindow($hWnd)
        Start-Sleep -Seconds 1
        
        [System.Windows.Forms.SendKeys]::SendWait("^f")
        Start-Sleep -Milliseconds 800
        [System.Windows.Forms.SendKeys]::SendWait($ZALO_GROUP_NAME)
        Start-Sleep -Seconds 1
        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
        Start-Sleep -Seconds 1
        [System.Windows.Forms.SendKeys]::SendWait("^v")
        Start-Sleep -Milliseconds 500
        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
        
        Write-Host "Success: Sent $pass to $ZALO_GROUP_NAME" -ForegroundColor Green
    }
}