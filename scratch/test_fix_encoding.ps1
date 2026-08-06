function Fix-TextEncoding([string]$text) {
    if (-not $text) { return $text }
    if ($text -match '[\u00C0-\u00FF]') {
        try {
            $bytes = [System.Text.Encoding]::GetEncoding(1252).GetBytes($text)
            $fixed = [System.Text.Encoding]::UTF8.GetString($bytes)
            return $fixed
        } catch {
            return $text
        }
    }
    return $text
}

$sampleBad = "BÃ¡o cÃ¡o tÃ¬nh hÃ¬nh WIP Ä‘áº¿n thá»i Ä‘iá»ƒm 08:01"
$sampleFixed = Fix-TextEncoding $sampleBad
Write-Host "Original:" $sampleBad
Write-Host "Fixed:   " $sampleFixed
