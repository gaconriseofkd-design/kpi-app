$tasks = Get-ScheduledTask -TaskPath "\"
$tasks | Select-Object TaskName, State, TaskPath | Format-Table -AutoSize
