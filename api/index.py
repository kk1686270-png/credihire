import os
import sys

# Ensure 'backend credihire' is accessible on sys.path
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
backend_dir = os.path.join(root_dir, "backend credihire")

if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# On Vercel Serverless (read-only filesystem), redirect sqlite database to /tmp
if os.environ.get("VERCEL"):
    os.environ.setdefault("AUTH_DATABASE_PATH", "/tmp/credihire-auth.sqlite3")

from app.main import create_app

app = create_app()
