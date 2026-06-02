@echo off
title Report Watcher Auto-Start
echo Dang khoi dong Report Watcher cho Zalo...
cd /d "C:\Users\prod.public\Ortholite Vietnam\OVN Production - Documents\PRODUCTION\TRUONG OFFICE\PROJECT\KPI APP\APP KPI\scripts"
powershell.exe -ExecutionPolicy Bypass -File "ReportWatcher.ps1"
