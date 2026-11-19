# CrediHire — Fake Job & Online Task Scam Detection System

**CrediHire** is an end-to-end cybersecurity intelligence and analysis platform designed to detect fake job solicitations, task-based scams, fraudulent recruitment websites, and upfront fee scams across multiple languages (English, Devanagari Hindi, and Hinglish).

---

## 1. Project Architecture & Components

The CrediHire ecosystem consists of five integrated modules:

```
credihire/
├── backend credihire/     # Central FastAPI Backend service (branch: backed)
│   ├── app/               # API routes, services, OCR upload extraction, URL credibility, chat
│   ├── engine_rules/      # Embedded Scam Intelligence rule engine
│   └── tests/             # 121 comprehensive pytest unit & integration tests
├── engine-rules/          # Karan's Scam Intelligence Rule Engine (branch: engine-rules)
│   └── engine-rules/      # Deterministic multilingual regex engine, scoring, 180 tests & demo.py
├── api-ai/                # Groq LLM integration microservice (branch: ai-api)
│   ├── backend/           # Groq client with openai/gpt-oss-20b, 82 unit tests
│   └── .env               # API configuration
├── frontend/              # Keshav's React + Vite web application (branch: frontend)
│   ├── src/               # Modern responsive UI with analysis forms, chatbot, visual scoring
│   └── tests/             # 30 node:test integration tests
├── browser-extension/     # Chrome / Edge Manifest V3 extension (branch: browser-extension)
│   ├── popup/, options/   # Browser popup, settings, background service worker
│   └── tests/             # 32 extension integrity and mock tests
├── run_all.bat            # One-click launcher for Backend + Frontend
├── run_backend.bat        # Launches Backend on http://127.0.0.1:8000
├── run_frontend.bat       # Launches React UI on http://localhost:5173
├── run_engine_rules_demo.bat # Runs Karan's interactive intelligence demo
├── test_all.ps1           # Runs all 445 unit & integration tests across all modules
└── README.md              # Project documentation and guide
```

---

## 2. Issues Diagnosed & Fixes Applied

When initially inspected, the workspace was in an unrunnable state due to the following:

1. **Empty Backend Directory (`backend credihire`)**:
   - The original download zip contained an empty directory for `backend credihire/`.
   - **Fix**: Recovered and cloned the official `backed` branch from the CrediHire Git repository into `backend credihire/`.
2. **Missing Backend Dependencies & Python 3.15 Compatibility**:
   - The system runs Python 3.15. The original backend requirements pinned `Pillow<12`, which lacks prebuilt Windows binaries for Python 3.15 and failed to compile without MSVC tools.
   - **Fix**: Installed compatible pure-wheel/prebuilt packages (`pydantic-settings>=2.5`, `PyMuPDF>=1.24`, `pytesseract>=0.3`, `python-multipart>=0.0.9`, `pytest-asyncio>=0.24`) matching the existing system packages.
3. **Broken Virtual Environment (`api-ai/.venv`)**:
   - `api-ai` contained an invalid `.venv` referencing a non-existent path on another machine (`C:\Program Files\Python314\python.exe`). Attempting to run pip inside it triggered Windows Application Control blocks.
   - **Fix**: Removed the invalid foreign `.venv`. Configured the system Python (configured in `.vscode/settings.json`) to run `api-ai` directly.
4. **Missing Environment Configuration (`.env`)**:
   - `backend credihire` was missing `.env`. Without it, Karan's rule engine adapter (`app.intelligence.karan_adapter:create_engine`) was unconfigured, returning `503 Service Unavailable`.
   - **Fix**: Created `backend credihire/.env` configured with `RULE_ENGINE_FACTORY=app.intelligence.karan_adapter:create_engine`, Groq credentials, and local CORS origins.
5. **Missing Frontend & Browser Extension**:
   - Cloned `origin/frontend` and `origin/browser-extension`, installed npm dependencies, created `frontend/.env` with `VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1`, and verified production Vite build.

---

## 3. How to Run the Project

### Option A: One-Click Full Stack (Recommended)
Double-click `run_all.bat` or run in terminal:
```cmd
.\run_all.bat
```
This automatically starts:
- **Backend API**: `http://127.0.0.1:8000` (Swagger docs at `/docs`)
- **React Frontend**: `http://localhost:5173`
- Opens your browser to the web app.

---

### Option B: Run Services Manually

#### 1. Central Backend API (Port 8000)
```powershell
cd "backend credihire"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
- Interactive API Docs: `http://127.0.0.1:8000/docs`
- Health check: `http://127.0.0.1:8000/api/v1/health`
- Integration readiness: `http://127.0.0.1:8000/api/v1/ready`

#### 2. React + Vite Frontend (Port 5173)
```powershell
cd frontend
npm run dev
```
- Open `http://localhost:5173`

#### 3. Karan's Scam Intelligence Rule Engine (Demo / Standalone)
```powershell
cd "engine-rules\engine-rules"
python demo.py
```
Or start its standalone API on port 8001:
```powershell
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8001 --reload
```

#### 4. Groq AI Service (Standalone API on Port 8002)
```powershell
cd api-ai
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8002 --reload
```

---

## 4. Verification & Test Suite

All 445 automated tests pass across the entire workspace:

```powershell
powershell -ExecutionPolicy Bypass -File .\test_all.ps1
```

| Component | Test Suite | Tests Passed | Status |
|---|---|---|---|
| **Engine-Rules** | `engine-rules/engine-rules/tests/` | 180 passed | PASSED |
| **API-AI** | `api-ai/backend/tests/` | 82 passed | PASSED |
| **Backend CrediHire** | `backend credihire/tests/` | 121 passed | PASSED |
| **Frontend UI** | `frontend/tests/` | 30 passed | PASSED |
| **Browser Extension** | `browser-extension/tests/` | 32 passed | PASSED |
| **Total** | | **445 passed** | **100% HEALTHY** |
