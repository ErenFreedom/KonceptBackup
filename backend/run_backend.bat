@echo off
cd /d "%~dp0"

echo 🔁 Syncing Local SensorBank IDs with Cloud...
nodejs\node.exe utils\syncLocalSensorIds.js

echo 🔁 Syncing LocalSensorAPIs...
nodejs\node.exe utils\syncSensorAPIs.js

timeout /t 2 >nul

echo 🚀 Starting Backend Server...
start "" nodejs\node.exe server.js