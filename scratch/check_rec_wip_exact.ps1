$parent = Get-ChildItem "C:\Users\prod.public\Ortholite Vietnam\OVN Production - Documents\PRODUCTION\" -Filter "Nh*n Lg" | Select-Object -First 1
$path = Join-Path $parent.FullName "Schedule\Ovn Pro Schedule.xlsb"

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

try {
    $wb = $excel.Workbooks.Open($path, 0, $true)
    $sh = $wb.Sheets.Item("RECORD WIP")
    
    Write-Host "=== CELL FORMULAS AND VALUES IN RECORD WIP ==="
    for ($c = 1; $c -le 5; $c++) {
        $cellHdr = $sh.Cells.Item(1, $c)
        $cellVal = $sh.Cells.Item(2, $c)
        $cellNote = $sh.Cells.Item(4, $c)
        
        Write-Host ("Col {0}: Hdr1='{1}' | ValText='{2}' | ValFormula='{3}' | Note4='{4}'" -f `
            $c, $cellHdr.Text, $cellVal.Text, $cellVal.Formula, $cellNote.Text)
    }
    
    $wb.Close($false)
} finally {
    $excel.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
}
