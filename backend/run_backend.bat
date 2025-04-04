@echo off
cd /d "%~dp0"
echo 🔁 Running Sensor API Sync...
start "" nodejs\node.exe utils\syncSensorAPIs.js

timeout /t 2 >nul

echo 🚀 Starting Backend Server...
start "" nodejs\node.exe server.js