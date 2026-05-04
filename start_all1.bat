

echo  v2.0 Redesigned UI + Original Backend

:: === BACKEND ===
echo [1/3] Preparing Backend Environment...
cd /d "%~dp0backend"

if not exist "venv" (
    echo [!] Creating virtual environment...
    python -m venv venv
)

call venv\Scripts\activate

echo [i] Installing backend dependencies (quiet)...
pip install -r requirements.txt -q

if not exist ".env" (
    echo [!] .env missing. Copying from .env.example...
    copy .env.example .env
    echo [!] IMPORTANT: Edit backend/.env with your API keys before proceeding.
)

:: === FRONTEND1 ===
echo.
echo [2/3] Preparing Frontend v2 (frontend1)...
cd /d "%~dp0frontend1"

if not exist "node_modules" (
    echo [!] Installing npm dependencies...
    npm install
)

:: === LAUNCH ===
echo.
echo [3/3] Launching Services...
echo.
echo =====================================================================
echo   BACKEND API  : http://localhost:8000
echo   FRONTEND v2  : http://localhost:3001
echo   API DOCS     : http://localhost:8000/docs
echo =====================================================================
echo.

:: Backend window
cd /d "%~dp0backend"
set PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION=python
start "UrbanEye-Backend" cmd /k "call venv\Scripts\activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

:: Frontend1 window (port 3001 to avoid conflict with original frontend)
cd /d "%~dp0frontend1"
start "UrbanEye-Frontend-v2" cmd /k "set PORT=3001 && npm start"

echo.
echo [SUCCESS] Both services launching in separate windows...
echo [i] Frontend v2 will open at: http://localhost:3001
echo [i] Backend API available at: http://localhost:8000
echo.
pause
