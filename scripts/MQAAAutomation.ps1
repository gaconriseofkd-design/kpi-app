# scripts/MQAAAutomation.ps1
# Script tự động gửi báo cáo MQAA vào Zalo mỗi sáng 08:00

# === Cấu hình (Người dùng thay đổi tại đây) ===
$SUPABASE_URL = "https://doyipagavbxupiwbitgi.supabase.co"
$SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRveWlwYWdhdmJ4dXBpd2JpdGdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMTc0NzUsImV4cCI6MjA3NDc5MzQ3NX0.hRCtL5wOxFXFPAR_r0vyYsL044d0caT-EZqx-p9kva0"
$ZALO_GROUP_NAME = "MQAA" # Nhập tên chính xác của nhóm Zalo

# === Khởi tạo thư viện ===
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Emojis and Labels as Unicode escapes to prevent file encoding issues
$E_ANNOUNCE = [char]0xD83D + [char]0xDCE2
$E_CALENDAR = [char]0xD83D + [char]0xDDD3
$E_LOCATION = [char]0xD83D + [char]0xDCCD
$E_USER = [char]0xD83D + [char]0xDC64
$E_OFFICER = [char]0xD83D + [char]0xDC6E
$E_WARNING = [char]0x26A0 + [char]0xFE0F
$E_NOTE = [char]0xD83D + [char]0xDCDD

# Vietnamese labels encoded to avoid Mojibake (Full Unicode Escapes)
$L_HEADER = "*B" + [char]0x00C1 + "O C" + [char]0x00C1 + "O VI PH" + [char]0x1EA0 + "M MQAA*"
$L_DATE = "Ng" + [char]0x00E0 + "y:"
$L_LINE = "Line:"
$L_WORKER = "Ng" + [char]0x01B0 + [char]0x1EDD + "i VP:"
$L_LEADER = "Leader:"
$L_ISSUE_TYPE = "Lo" + [char]0x1EA1 + "i:"
$L_DESCRIPTION = "M" + [char]0x00F4 + " t" + [char]0x1EA3 + ":"
$L_SEP = "-----------------------"

function Send-ZaloMessage {
    param([string]$text)
    # Use .NET Clipboard for better Unicode handling in PowerShell 5.1
    [System.Windows.Forms.Clipboard]::SetText($text)
    [System.Windows.Forms.SendKeys]::SendWait("^v")
    Start-Sleep -Milliseconds 500
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Start-Sleep -Milliseconds 500
}

function Send-ZaloImageGroup {
    param([string[]]$imageUrls)
    if ($imageUrls.Count -eq 0) { return }
    
    $tempFolder = Join-Path $env:TEMP ("mqaa_group_" + (Get-Date -Format "yyyyMMdd_HHmmss") + "_" + (Get-Random))
    $null = New-Item -ItemType Directory -Path $tempFolder -Force
    
    $filePaths = New-Object System.Collections.Specialized.StringCollection
    
    try {
        foreach ($url in $imageUrls) {
            $fileName = [System.IO.Path]::GetFileName(([uri]$url).AbsolutePath)
            if (-not $fileName) { $fileName = "image_$(Get-Random).jpg" }
            $localPath = Join-Path $tempFolder $fileName
            
            Invoke-WebRequest -Uri $url -OutFile $localPath
            [void]$filePaths.Add($localPath)
        }
        
        # Set clipboard as FileDropList (this allows Zalo to group them)
        [System.Windows.Forms.Clipboard]::SetFileDropList($filePaths)
        
        [System.Windows.Forms.SendKeys]::SendWait("^v")
        Start-Sleep -Milliseconds 2000 # Wait for Zalo to process group
        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
        Start-Sleep -Seconds 2
    }
    catch {
        Write-Warning "Lỗi khi gom nhóm ảnh: $($_.Exception.Message)"
    }
    finally {
        # Cleanup
        if (Test-Path $tempFolder) {
            Remove-Item -Path $tempFolder -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

# === Bắt đầu thực hiện ===
$yesterday = (Get-Date).AddDays(-1).ToString("yyyy-MM-dd")
Write-Host "-------------------------------------------"
Write-Host "Đang lấy dữ liệu MQAA cho ngày: $yesterday"

# Thiết lập headers Supabase
$headers = @{
    "apikey"        = $SUPABASE_KEY
    "Authorization" = "Bearer $SUPABASE_KEY"
}

# 0. Lấy cấu hình hệ thống
try {
    $settingsUrl = "$SUPABASE_URL/rest/v1/mqaa_settings?id=eq.1"
    $settings = Invoke-RestMethod -Uri $settingsUrl -Headers $headers -Method Get
    if ($settings) {
        $ZALO_GROUP_NAME = $settings[0].zalo_group
        $IMAGE_LIMIT = $settings[0].image_limit
        Write-Host "Cấu hình: Nhóm '$ZALO_GROUP_NAME', Giới hạn $IMAGE_LIMIT ảnh."
    }
}
catch {
    Write-Warning "Không thể lấy cấu hình, dùng mặc định."
    $IMAGE_LIMIT = 10
}

# 1. Truy vấn dữ liệu vi phạm
$url = "$SUPABASE_URL/rest/v1/mqaa_logs?date=eq.$yesterday"
Write-Host "URL: $url"

try {
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
    if ($response.Count -eq 0) {
        Write-Host "Không có vi phạm nào trong ngày hôm qua."
        exit
    }

    Write-Host "Tìm thấy $($response.Count) bản ghi. Bắt đầu gửi Zalo..."

    # 2. Kích hoạt Zalo
    $zalo = Get-Process -Name Zalo -ErrorAction SilentlyContinue
    if (-not $zalo) {
        Write-Error "Zalo PC chưa mở. Vui lòng mở Zalo trước."
        exit
    }
    
    # Kích hoạt cửa sổ Zalo (Sử dụng AppActivate)
    $wshell = New-Object -ComObject WScript.Shell
    $wshell.AppActivate("Zalo")
    Start-Sleep -Seconds 2

    # 3. Tìm nhóm Zalo
    [System.Windows.Forms.SendKeys]::SendWait("^f")
    Start-Sleep -Milliseconds 500
    [System.Windows.Forms.Clipboard]::SetText($ZALO_GROUP_NAME)
    [System.Windows.Forms.SendKeys]::SendWait("^v")
    Start-Sleep -Seconds 1
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Start-Sleep -Seconds 1

    # 4. Gửi từng bản ghi
    foreach ($log in $response) {
        # Build message string using concatenation for maximum safety
        $msg = $E_ANNOUNCE + " " + $L_HEADER + "`n" +
        $L_SEP + "`n" +
        $E_CALENDAR + " " + $L_DATE + " " + $log.date + "`n" +
        $E_LOCATION + " " + $L_LINE + " " + $log.line + "`n" +
        $E_USER + " " + $L_WORKER + " " + $log.worker_name + " (" + $log.worker_id + ")`n" +
        $E_OFFICER + " " + $L_LEADER + " " + $log.leader_name + "`n" +
        $E_WARNING + " " + $L_ISSUE_TYPE + " " + $log.issue_type + "`n" +
        $E_NOTE + " " + $L_DESCRIPTION + " " + $log.description + "`n" +
        $L_SEP
        
        Send-ZaloMessage -text $msg
        
        if ($log.image_url) {
            # Convert to array if it is a single string and apply limit
            $urls = if ($log.image_url -is [array]) { $log.image_url } else { @($log.image_url) }
            
            # Giới hạn số lượng ảnh gửi theo cấu hình
            if ($urls.Count -gt $IMAGE_LIMIT) {
                Write-Host "Ghi đè giới hạn ảnh: $($urls.Count) -> $IMAGE_LIMIT"
                $urls = $urls[0..($IMAGE_LIMIT - 1)]
            }
            
            Send-ZaloImageGroup -imageUrls $urls
        }
    }

    Write-Host "Hoàn thành gửi báo cáo!"

}
catch {
    Write-Error "Lỗi thực thi: $($_.Exception.Message)"
}
