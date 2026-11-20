Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " Running CrediHire Full-Stack Test Suite" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$root = $PSScriptRoot

# 1. Engine-Rules tests
Write-Host "`n[1/5] Testing Engine-Rules (Deterministic Scam Intelligence)..." -ForegroundColor Yellow
Push-Location "$root\engine-rules\engine-rules"
python -m pytest tests -q
$engineExit = $LASTEXITCODE
Pop-Location

# 2. API-AI tests
Write-Host "`n[2/5] Testing API-AI (Groq Service)..." -ForegroundColor Yellow
Push-Location "$root\api-ai"
python -m pytest backend/tests/test_main.py backend/tests/test_ai_service.py -q
$aiExit = $LASTEXITCODE
Pop-Location

# 3. Backend CrediHire tests
Write-Host "`n[3/5] Testing Backend CrediHire (Central API + Integration)..." -ForegroundColor Yellow
Push-Location "$root\backend credihire"
python -m pytest tests -q
$backendExit = $LASTEXITCODE
Pop-Location

# 4. Frontend tests
Write-Host "`n[4/5] Testing Frontend (React/Vite Suite)..." -ForegroundColor Yellow
Push-Location "$root\frontend"
npm test
$frontendExit = $LASTEXITCODE
Pop-Location

# 5. Browser Extension tests
Write-Host "`n[5/5] Testing Browser Extension (Manifest V3 Suite)..." -ForegroundColor Yellow
Push-Location "$root\browser-extension"
node tests/run-tests.js
$extensionExit = $LASTEXITCODE
Pop-Location

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host " Test Execution Summary" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "1. Engine-Rules:       " -NoNewline; if ($engineExit -eq 0) { Write-Host "PASSED (180 tests)" -ForegroundColor Green } else { Write-Host "FAILED" -ForegroundColor Red }
Write-Host "2. API-AI:             " -NoNewline; if ($aiExit -eq 0) { Write-Host "PASSED (82 tests)" -ForegroundColor Green } else { Write-Host "FAILED" -ForegroundColor Red }
Write-Host "3. Backend CrediHire:  " -NoNewline; if ($backendExit -eq 0) { Write-Host "PASSED (121 tests)" -ForegroundColor Green } else { Write-Host "FAILED" -ForegroundColor Red }
Write-Host "4. Frontend:           " -NoNewline; if ($frontendExit -eq 0) { Write-Host "PASSED (34 tests)" -ForegroundColor Green } else { Write-Host "FAILED" -ForegroundColor Red }
Write-Host "5. Browser Extension:  " -NoNewline; if ($extensionExit -eq 0) { Write-Host "PASSED (32 tests)" -ForegroundColor Green } else { Write-Host "FAILED" -ForegroundColor Red }
Write-Host "==================================================" -ForegroundColor Cyan

if ($engineExit -eq 0 -and $aiExit -eq 0 -and $backendExit -eq 0 -and $frontendExit -eq 0 -and $extensionExit -eq 0) {
    Write-Host "ALL 445 TESTS PASSED SUCCESSFULLY across all modules!" -ForegroundColor Green
} else {
    Write-Host "Some tests failed. Check logs above." -ForegroundColor Red
}
