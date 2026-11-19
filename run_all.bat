@echo off
echo ==================================================
echo  Starting CrediHire Full-Stack (Backend + Frontend)
echo ==================================================
start "CrediHire Backend API (Port 8000)" cmd /k "%~dp0run_backend.bat"
timeout /t 2 >nul
start "CrediHire React Frontend (Port 5173)" cmd /k "%~dp0run_frontend.bat"
timeout /t 3 >nul
start http://localhost:5173
echo CrediHire is starting up!
echo Backend:  http://127.0.0.1:8000/docs
echo Frontend: http://localhost:5173
