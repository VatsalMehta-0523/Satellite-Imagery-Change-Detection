@echo off
set "VENV_BIN=%~dp0venv\Scripts"
set "PATH=%VENV_BIN%;%PATH%"
set "PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION=python"
echo ^>^>^> [ORION] Starting LangGraph Development Server via VENV (C++ Bypass Active)...
langgraph dev
