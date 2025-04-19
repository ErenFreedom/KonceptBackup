@echo off
cd /d "%~dp0"

set LOGFILE=%APPDATA%\ConnectorBackend\backend_log.txt
echo 🔁 Syncing local sensor tables with Cloud... >> "%LOGFILE%" 2>&1
nodejs\node.exe utils\syncLocalSensorIds.js >> "%LOGFILE%" 2>&1

timeout /t 2 >nul

echo 🚀 Starting Backend Server... >> "%LOGFILE%" 2>&1
start "" /b nodejs\node.exe server.js >> "%LOGFILE%" 2>&1