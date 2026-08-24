$excelPath = "c:\Users\prod.public\Ortholite Vietnam\OVN Production - Documents\PRODUCTION\TRUONG OFFICE\PROJECT\KPI APP\APP KPI\% OT.xlsx"
try {
    $wb = [System.Runtime.InteropServices.Marshal]::BindToMoniker($excelPath)
    Write-Host "Found workbook via BindToMoniker!"
    Write-Host "Name: $($wb.Name)"
    $excel = $wb.Application
    Write-Host "Excel Version: $($excel.Version)"
} catch {
    Write-Host "Failed to BindToMoniker: $_"
}
