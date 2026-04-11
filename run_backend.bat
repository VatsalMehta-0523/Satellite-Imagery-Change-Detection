@echo off
cd /d "%~dp0backend"

if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

call venv\Scripts\activate

echo Installing dependencies...
pip install -r requirements.txt -q

echo.
echo ========================================
echo   GeoVision Backend starting on :8000
echo ========================================
echo.

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
