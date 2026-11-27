<# :
@echo off
title CrediHire AI - 1-Click Platform Launcher
color 0b
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Invoke-Expression ([System.IO.File]::ReadAllText('%~f0', [System.Text.Encoding]::UTF8))"
exit /b %ERRORLEVEL%
#>

# ====================================================
# CrediHire AI - 1-Click Platform Launcher (Engine)
# ====================================================
$ErrorActionPreference = "SilentlyContinue"

Clear-Host
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "         CrediHire AI - 1-Click Launcher           " -ForegroundColor Yellow
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Determine Project Directory
$ProjectDir = "C:\Users\kk168\Downloads\credihire\credihire"
if (-not (Test-Path "$ProjectDir\backend credihire")) {
    $PotentialDirs = @(
        "$PSScriptRoot\credihire",
        "$PSScriptRoot",
        "C:\Users\kk168\Downloads\credihire"
    )
    foreach ($dir in $PotentialDirs) {
        if (Test-Path "$dir\backend credihire") {
            $ProjectDir = $dir
            break
        }
    }
}

Write-Host "[*] Project Directory: $ProjectDir" -ForegroundColor Gray

# 2. Check and clear any old zombie processes on ports 8000 and 5173
Write-Host "[1/3] Checking & clearing existing ports (8000 & 5173)..." -ForegroundColor Cyan
$ExistingPorts = Get-NetTCPConnection -LocalPort 8000, 5173 -State Listen -ErrorAction SilentlyContinue
if ($ExistingPorts) {
    foreach ($conn in $ExistingPorts) {
        try {
            Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
        } catch {}
    }
    Start-Sleep -Milliseconds 800
}
Write-Host "      Ports 8000 and 5173 are ready." -ForegroundColor Green

# 3. Locate Python and Node/NPM
$PythonExe = "python"
if (Test-Path "C:\Users\kk168\AppData\Local\Python\pythoncore-3.15-64\python.exe") {
    $PythonExe = "C:\Users\kk168\AppData\Local\Python\pythoncore-3.15-64\python.exe"
} else {
    $FoundPy = (Get-Command python -ErrorAction SilentlyContinue).Source
    if ($FoundPy -and ($FoundPy -notlike "*WindowsApps*")) { $PythonExe = $FoundPy }
}

$NpmCmd = "npm.cmd"
if (Test-Path "C:\Program Files\nodejs\npm.cmd") {
    $NpmCmd = "C:\Program Files\nodejs\npm.cmd"
} else {
    $FoundNpm = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
    if ($FoundNpm) { $NpmCmd = $FoundNpm }
}

# 4. Start Backend (FastAPI on Port 8000)
Write-Host "[2/3] Starting Backend & Frontend services in background..." -ForegroundColor Cyan
$BackendDir = "$ProjectDir\backend credihire"
$BackendProc = Start-Process -FilePath $PythonExe `
    -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000" `
    -WorkingDirectory $BackendDir `
    -WindowStyle Minimized `
    -PassThru

# 5. Start Frontend (Vite on Port 5173)
$FrontendDir = "$ProjectDir\frontend"
$FrontendProc = Start-Process -FilePath $NpmCmd `
    -ArgumentList "run", "dev", "--", "--port", "5173", "--strictPort" `
    -WorkingDirectory $FrontendDir `
    -WindowStyle Minimized `
    -PassThru

# 6. Wait for Frontend to respond with HTTP 200
Write-Host "[3/3] Waiting for website to be ready" -NoNewline -ForegroundColor Cyan
$IsReady = $false
$Attempts = 0
$MaxAttempts = 40

while (-not $IsReady -and $Attempts -lt $MaxAttempts) {
    Start-Sleep -Milliseconds 600
    $Attempts++
    Write-Host -NoNewline "." -ForegroundColor Yellow
    try {
        $Response = Invoke-WebRequest -Uri "http://localhost:5173/" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($Response.StatusCode -eq 200) {
            $IsReady = $true
        }
    } catch {
        # Still starting up
    }
}
Write-Host ""

if ($IsReady) {
    Write-Host ""
    Write-Host "====================================================" -ForegroundColor Green
    Write-Host "   SUCCESS! CrediHire is now running on:" -ForegroundColor Green
    Write-Host "   -> http://localhost:5173/" -ForegroundColor Yellow
    Write-Host "====================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "[+] Opening CrediHire in your browser..." -ForegroundColor Cyan
    Start-Process "http://localhost:5173/"
} else {
    Write-Host ""
    Write-Host "[!] Notice: Services are still initializing. Opening browser..." -ForegroundColor Yellow
    Start-Process "http://localhost:5173/"
}

Write-Host ""
Write-Host "CrediHire platform is currently ACTIVE." -ForegroundColor White
Write-Host "You can keep this window minimized while using the website." -ForegroundColor Gray
Write-Host ""
Write-Host "----------------------------------------------------" -ForegroundColor DarkGray
Write-Host "Press [ENTER] at any time to close all servers and exit." -ForegroundColor Yellow
Write-Host "----------------------------------------------------" -ForegroundColor DarkGray
Write-Host ""

$null = Read-Host

Write-Host ""
Write-Host "[*] Stopping CrediHire servers..." -ForegroundColor Cyan
try {
    if ($BackendProc -and -not $BackendProc.HasExited) { Stop-Process -Id $BackendProc.Id -Force -ErrorAction SilentlyContinue }
    if ($FrontendProc -and -not $FrontendProc.HasExited) { Stop-Process -Id $FrontendProc.Id -Force -ErrorAction SilentlyContinue }
} catch {}

$ExistingPorts = Get-NetTCPConnection -LocalPort 8000, 5173 -State Listen -ErrorAction SilentlyContinue
if ($ExistingPorts) {
    foreach ($conn in $ExistingPorts) {
        try { Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue } catch {}
    }
}
Write-Host "[+] All servers stopped cleanly. Goodbye!" -ForegroundColor Green
Start-Sleep -Seconds 1
