# scratch\test_excel_read.ps1
$EXCEL_PATH = "C:\Users\prod.public\Ortholite Vietnam\OVN Production - Documents\PRODUCTION\TRUONG OFFICE\Tiếng Nói Từ Hiện Trường Sản Xuất.xlsx"

if (-not (Test-Path $EXCEL_PATH)) {
    Write-Host "File not found: $EXCEL_PATH"
    exit 1
}

$excel = $null
try {
    $excel = [System.Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
    Write-Host "Attached to running Excel instance."
} catch {
    $excel = New-Object -ComObject Excel.Application
    Write-Host "Created new Excel instance."
}

$excel.Visible = $false
$excel.DisplayAlerts = $false

$workbook = $null
# Try to find if workbook is already open
foreach ($wb in $excel.Workbooks) {
    if ($wb.FullName -eq $EXCEL_PATH) {
        $workbook = $wb
        Write-Host "Workbook is already open."
        break
    }
}

$wasOpenedByUs = $false
if (-not $workbook) {
    $workbook = $excel.Workbooks.Open($EXCEL_PATH, 0, $true) # ReadOnly
    $wasOpenedByUs = $true
    Write-Host "Opened workbook read-only."
}

$sheet = $workbook.Sheets.Item(1) # Assuming first sheet
$lastRow = $sheet.Cells.Item($sheet.Rows.Count, 1).End(-4162).Row # xlUp

Write-Host "Last Row: $lastRow"

$data = @()
for ($i = 2; $i -le $lastRow; $i++) {
    $timeStr = $sheet.Cells.Item($i, 2).Text
    $section = $sheet.Cells.Item($i, 6).Text
    $opinion = $sheet.Cells.Item($i, 7).Text
    
    if (-not [string]::IsNullOrWhiteSpace($opinion)) {
        $data += [PSCustomObject]@{
            Time = $timeStr
            Section = $section
            Opinion = $opinion
        }
    }
}

$data | Format-Table -AutoSize

if ($wasOpenedByUs) {
    $workbook.Close($false)
}
# Don't quit excel if we attached to an existing one, unless we created it?
# Let's not quit for testing.
