@echo off
cd /d "%~dp0"

echo 🔁 Syncing all local sensor tables with Cloud...
nodejs\node.exe utils\syncLocalSensorIds.js

IF %ERRORLEVEL% NEQ 0 (
    echo ❌ Sync script failed with exit code %ERRORLEVEL%
    pause
    exit /b
)

timeout /t 2 >nul

echo 🚀 Starting Backend Server...
nodejs\node.exe server.js

echo 🛑 Backend exited with code %ERRORLEVEL%
pause