@echo off
setlocal enabledelayedexpansion

:: =====================================================================
::  GEOVISION UNIFIED MISSION CONTROL LAUNCHER
:: =====================================================================
:: This script initializes and starts both Backend and Frontend.
:: =====================================================================

echo.
echo [1/3] Verifying Backend Environment...
cd /d "%~dp0backend"

:: Check Venv
if not exist "venv" (
    echo [!] Backend Virtual Environment missing. Creating...
    python -m venv venv
)

:: Activate and install requirements
echo [i] Syncing Backend Dependencies...
call venv\Scripts\activate
pip install -r requirements.txt -q

:: Check .env
if not exist ".env" (
    echo [!] WARNING: backend/.env not found. 
    echo [!] Copying .env.example...
    copy .env.example .env
    echo [!] PLEASE EDIT backend/.env WITH YOUR REAL API KEYS.
)

echo.
echo [2/3] Verifying Frontend Environment...
cd /d "%~dp0frontend"

:: Check node_modules
if not exist "node_modules" (
    echo [!] Frontend dependencies missing. Installing...
    npm install
)

echo.
echo [3/3] MISSION READY. IGNITION SEQUEUNCE STARTING...
echo.
echo =====================================================================
echo   BACKEND: http://localhost:8000
echo   FRONTEND: http://localhost:3000
echo =====================================================================
echo.

:: Launch Backend in separate window
cd /d "%~dp0backend"
start "GeoVision-Backend-Process" cmd /k "call venv\Scripts\activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

:: Launch Frontend in separate window
cd /d "%~dp0frontend"
start "GeoVision-Frontend-Interface" cmd /k "npm start"

echo.
echo [SUCCESS] Operation Orchestrated.
echo [i] Keep this window open or close it; the sub-processes are independent.
pause
