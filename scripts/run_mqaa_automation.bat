@echo off
REM scripts/run_mqaa_automation.bat
REM Chạy script gửi báo cáo Zalo
powershell.exe -ExecutionPolicy Bypass -File "%~dp0MQAAAutomation.ps1"
pause
