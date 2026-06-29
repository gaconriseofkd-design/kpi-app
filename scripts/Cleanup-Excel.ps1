# scripts/Cleanup-Excel.ps1
param([switch]$ManualTrigger)

try {
    # Thay vì kill toàn bộ Excel ẩn (dễ làm tắt nhầm Excel đang treo/mở của người dùng),
    # Ta chỉ dọn dẹp bộ nhớ Garbage Collector để giải phóng các COM Object đã release.
    # Việc dọn dẹp process Excel của user đã được gỡ bỏ để tránh tắt nhầm.
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
} catch {}
