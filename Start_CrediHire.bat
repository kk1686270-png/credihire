@echo off
title CrediHire AI 1-Click Launcher
color 0b

echo ====================================================
echo         CrediHire AI - 1-Click Launcher
echo ====================================================
echo.

set "PROJECT_DIR=C:\Users\kk168\Downloads\credihire\credihire"
if exist "%~dp0backend credihire" set "PROJECT_DIR=%~dp0"
if exist "%~dp0credihire\backend credihire" set "PROJECT_DIR=%~dp0credihire"

echo [*] Working Directory: %PROJECT_DIR%
echo.

:: 1. Check and start Backend (Port 8000)
netstat -ano | findstr :8000 | findstr LISTENING >nul 2>&1
if %ERRORLEVEL% EQU 0 goto :backend_already_up

echo [+] Starting Backend Server on port 8000...
start "CrediHire_Backend" /min cmd /c "cd /d \"%PROJECT_DIR%\backend credihire\" && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000"
goto :check_frontend

:backend_already_up
echo [OK] Backend is already running on port 8000.

:check_frontend
:: 2. Check and start Frontend (Port 5173)
netstat -ano | findstr :5173 | findstr LISTENING >nul 2>&1
if %ERRORLEVEL% EQU 0 goto :frontend_already_up

echo [+] Starting Frontend Server on port 5173...
start "CrediHire_Frontend" /min cmd /c "cd /d \"%PROJECT_DIR%\frontend\" && npm run dev"
goto :launch_browser

:frontend_already_up
echo [OK] Frontend is already running on port 5173.

:launch_browser
echo.
echo [*] Initializing services...
ping -n 3 127.0.0.1 >nul

echo [+] Opening CrediHire in your browser...
start "" "http://localhost:5173/"

echo.
echo ====================================================
echo   CrediHire is now LIVE at http://localhost:5173/
echo.
echo   You can minimize this window!
echo ====================================================
echo.
ping -n 4 127.0.0.1 >nul
exit
