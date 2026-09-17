@echo off
title KPI APP - Ortholite Vietnam
echo Dang kiem tra va mo ung dung KPI...

set "EDGE_PATH=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE_PATH%" (
    set "EDGE_PATH=C:\Program Files\Microsoft\Edge\Application\msedge.exe"
)
if not exist "%EDGE_PATH%" (
    set "EDGE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe"
)
if not exist "%EDGE_PATH%" (
    set "EDGE_PATH=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
)

rem Kiem tra thu muc dist
if not exist "%~dp0dist\index.html" (
    echo [CANH BAO] Khong tim thay tep: "%~dp0dist\index.html"
    echo Vui long kiem tra lai thu muc 'dist' phai nam cung vi tri voi file bat nay!
    pause
    exit /b
)

rem Chuyen toan bo dau \ thanh / de tranh Edge hieu nham ky tu escape (vi du: \tuan.nt bi bien thanh ky tu TAB)
set "APP_DIR=%~dp0"
set "APP_DIR=%APP_DIR:\=/%"

start "" "%EDGE_PATH%" --ignore-certificate-errors --allow-file-access-from-files --allow-file-access --disable-web-security --user-data-dir="%TEMP%\edge_app_profile" --app="file:///%APP_DIR%dist/index.html"

