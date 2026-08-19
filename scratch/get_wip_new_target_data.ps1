$parent = Get-ChildItem "C:\Users\prod.public\Ortholite Vietnam\OVN Production - Documents\PRODUCTION\" -Filter "Nh*n Lg" | Select-Object -First 1
$path = Join-Path $parent.FullName "Schedule\Ovn Pro Schedule.xlsb"

if (Test-Path $path) {
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    try {
        $wb = $excel.Workbooks.Open($path, 0, $true)
        $sh = $wb.Sheets.Item("RECORD WIP")
        
        Write-Host "=== DATA IN RECORD WIP SHEET ==="
        for ($r = 1; $r -le 6; $r++) {
            $line = "Row ${r}: "
            for ($c = 1; $c -le 5; $c++) {
                $val = $sh.Cells.Item($r, $c).Text
                $line += "Col ${c} = '$val' | "
            }
            Write-Host $line
        }
        $wb.Close($false)
    } finally {
        $excel.Quit()
        [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
    }
}
