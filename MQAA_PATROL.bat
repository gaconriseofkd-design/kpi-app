@echo off
title KPI APP - MQAA Patrol - Ortholite Vietnam
echo Dang mo Phan he MQAA Patrol...

set "EDGE_PATH=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE_PATH%" (
    set "EDGE_PATH=C:\Program Files\Microsoft\Edge\Application\msedge.exe"
)

start "" "%EDGE_PATH%" --ignore-certificate-errors --allow-file-access-from-files --allow-file-access --disable-web-security --user-data-dir="%TEMP%\edge_app_profile" --app="%~dp0dist\index.html#/mqaa-patrol"
