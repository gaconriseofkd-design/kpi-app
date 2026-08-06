$utf8BOM = New-Object System.Text.UTF8Encoding $true
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$files = Get-ChildItem -Path (Join-Path $scriptDir "*.ps1")
foreach ($f in $files) {
    try {
        $content = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
        [System.IO.File]::WriteAllText($f.FullName, $content, $utf8BOM)
        Write-Host "Fixed UTF-8 BOM for: $($f.Name)"
    } catch {}
}

