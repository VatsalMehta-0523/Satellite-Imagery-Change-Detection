@echo off
cd /d "%~dp0frontend"

if not exist "node_modules" (
    echo Installing npm dependencies...
    npm install
)

echo.
echo ========================================
echo   GeoVision Frontend starting on :3000
echo ========================================
echo.

npm start
