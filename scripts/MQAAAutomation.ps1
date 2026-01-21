# scripts/MQAAAutomation.ps1
# Script tự động gửi báo cáo MQAA vào Zalo mỗi sáng 08:00

# === Cấu hình (Người dùng thay đổi tại đây) ===
$SUPABASE_URL = "YOUR_SUPABASE_URL"
$SUPABASE_KEY = "YOUR_SUPABASE_ANON_KEY"
$ZALO_GROUP_NAME = "NHÓM BÁO CÁO MQAA" # Nhập tên chính xác của nhóm Zalo

# === Khởi tạo thư viện ===
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

function Send-ZaloMessage {
    param([string]$text)
    [System.Windows.Forms.Clipboard]::SetText($text)
    [System.Windows.Forms.SendKeys]::SendWait("^v")
    Start-Sleep -Milliseconds 500
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Start-Sleep -Milliseconds 500
}

function Send-ZaloImage {
    param([string]$imageUrl)
    if (-not $imageUrl) { return }
    
    $tempFile = "$env:TEMP\mqaa_temp_$(Get-Random).jpg"
    Invoke-WebRequest -Uri $imageUrl -OutFile $tempFile
    
    # Load image to clipboard
    $img = [System.Drawing.Image]::FromFile($tempFile)
    [System.Windows.Forms.Clipboard]::SetImage($img)
    $img.Dispose()
    
    [System.Windows.Forms.SendKeys]::SendWait("^v")
    Start-Sleep -Milliseconds 1000
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Start-Sleep -Milliseconds 1000
    
    Remove-Item $tempFile -ErrorAction SilentlyContinue
}

# === Bắt đầu thực hiện ===
$yesterday = (Get-Date).AddDays(-1).ToString("yyyy-MM-dd")
Write-Host "Đang lấy dữ liệu MQAA cho ngày: $yesterday"

# Truy vấn Supabase (Sử dụng REST API)
$headers = @{
    "apikey"        = $SUPABASE_KEY
    "Authorization" = "Bearer $SUPABASE_KEY"
}
$url = "$SUPABASE_URL/rest/v1/mqaa_logs?date=eq.$yesterday"

try {
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
    if ($response.Count -eq 0) {
        Write-Host "Không có vi phạm nào trong ngày hôm qua."
        exit
    }

    Write-Host "Tìm thấy $($response.Count) bản ghi. Bắt đầu gửi Zalo..."

    # 1. Kích hoạt Zalo
    $zalo = Get-Process -Name Zalo -ErrorAction SilentlyContinue
    if (-not $zalo) {
        Write-Error "Zalo PC chưa mở. Vui lòng mở Zalo trước."
        exit
    }
    
    # Kích hoạt cửa sổ Zalo (Sử dụng AppActivate)
    $wshell = New-Object -ComObject WScript.Shell
    $wshell.AppActivate("Zalo")
    Start-Sleep -Seconds 2

    # 2. Tìm nhóm Zalo
    [System.Windows.Forms.SendKeys]::SendWait("^f")
    Start-Sleep -Milliseconds 500
    [System.Windows.Forms.Clipboard]::SetText($ZALO_GROUP_NAME)
    [System.Windows.Forms.SendKeys]::SendWait("^v")
    Start-Sleep -Seconds 1
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Start-Sleep -Seconds 1

    # 3. Gửi từng bản ghi
    foreach ($log in $response) {
        $msg = @"
📢 *BÁO CÁO VI PHẠM MQAA*
-----------------------
🗓 Ngày: $($log.date)
📍 Line: $($log.line)
👤 Người VP: $($log.worker_name) ($($log.worker_id))
👮 Leader: $($log.leader_name)
⚠️ Loại: $($log.issue_type)
📝 Mô tả: $($log.description)
-----------------------
"@
        Send-ZaloMessage -text $msg
        
        if ($log.image_url) {
            # Kiểm tra nếu là mảng nhiều ảnh
            if ($log.image_url -is [array]) {
                foreach ($url in $log.image_url) {
                    Send-ZaloImage -imageUrl $url
                }
            }
            else {
                Send-ZaloImage -imageUrl $log.image_url
            }
        }
    }

    Write-Host "Hoàn thành gửi báo cáo!"

}
catch {
    Write-Error "Lỗi thực thi: $($_.Exception.Message)"
}
