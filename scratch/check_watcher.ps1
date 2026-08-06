Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*ReportWatcher*" -or $_.CommandLine -like "*Automation*" } | Select-Object ProcessId, Name, CommandLine | Format-Table -AutoSize
