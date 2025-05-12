@echo off
cd /d "%~dp0"

REM ✅ Set up a separate log folder outside of ConnectorBackend
set LOGDIR=%LOCALAPPDATA%\ConnectorLogs
if not exist "%LOGDIR%" mkdir "%LOGDIR%"
set LOGFILE=%LOGDIR%\backend_log.txt

echo [%date% %time%] 🔁 Syncing all local sensor tables with Cloud... >> "%LOGFILE%"
nodejs\node.exe utils\syncLocalSensorIds.js >> "%LOGFILE%" 2>&1

timeout /t 2 >nul

echo [%date% %time%] 🚀 Starting Backend Server... >> "%LOGFILE%"
start "" nodejs\node.exe server.js >> "%LOGFILE%" 2>&1