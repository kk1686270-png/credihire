@echo off
echo ==================================================
echo  Starting CrediHire Backend API Server
echo ==================================================
cd /d "%~dp0backend credihire"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
pause
