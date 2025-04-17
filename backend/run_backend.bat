@echo off
cd /d "%~dp0"

echo 🔁 Syncing all local sensor tables with Cloud...
nodejs\node.exe utils\syncLocalSensorIds.js

timeout /t 2 >nul

echo 🚀 Starting Backend Server...
start "" nodejs\node.exe server.js