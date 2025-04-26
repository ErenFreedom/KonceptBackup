@echo off
cd /d "%~dp0"

:: Set up log file
set LOGFILE=%APPDATA%\ConnectorBackend\backend_log.txt

:: Make sure log file folder exists
if not exist "%APPDATA%\ConnectorBackend" (
    mkdir "%APPDATA%\ConnectorBackend"
)

:: Start logging
echo. >> "%LOGFILE%"
echo ======== [STARTING BACKEND] %date% %time% ======== >> "%LOGFILE%"

:: Log current directory
echo 📁 Current Directory: %CD% >> "%LOGFILE%"

:: Check if node.exe exists
if exist "nodejs\node.exe" (
    echo ✅ Found portable Node.js >> "%LOGFILE%"
) else (
    echo ❌ nodejs\node.exe not found! >> "%LOGFILE%"
)

:: Check if server.js exists
if exist "server.js" (
    echo ✅ Found server.js >> "%LOGFILE%"
) else (
    echo ❌ server.js not found! >> "%LOGFILE%"
)

:: Sync sensor IDs
echo 🔁 Syncing local sensor tables with Cloud... >> "%LOGFILE%"
nodejs\node.exe utils\syncLocalSensorIds.js >> "%LOGFILE%" 2>&1

:: Wait 2 seconds
timeout /t 2 >nul

:: Start backend server
echo 🚀 Starting Backend Server... >> "%LOGFILE%"
start "" /b nodejs\node.exe server.js >> "%LOGFILE%" 2>&1

echo ======== [BACKEND STARTUP ATTEMPTED] %date% %time% ======== >> "%LOGFILE%"