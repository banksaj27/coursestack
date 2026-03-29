"""CourseStack FastAPI on Modal.

Prereqs:
  pip install -r requirements-modal.txt
  modal token new   # once, for Modal auth

Create a Modal Secret named coursestack-backend with the same keys as backend/.env.example
(GOOGLE_API_KEY, GEMINI_MODEL, ELEVENLABS_API_KEY, etc.).

Deploy:
  modal deploy modal_app.py

Use the printed HTTPS URL as NEXT_PUBLIC_API_URL on Vercel (no trailing slash).
"""

from __future__ import annotations

from pathlib import Path

import modal

REPO_ROOT = Path(__file__).resolve().parent
BACKEND_DIR = REPO_ROOT / "backend"
REQ_FILE = BACKEND_DIR / "requirements.txt"

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install_from_requirements(str(REQ_FILE))
    .add_local_dir(str(BACKEND_DIR), remote_path="/root/backend")
)

app = modal.App("coursestack-api")


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("coursestack-backend")],
    timeout=86400,
    memory=2048,
)
@modal.concurrent(max_inputs=100)
@modal.asgi_app()
def serve():
    import sys

    sys.path.insert(0, "/root/backend")
    from main import app as fastapi_app

    return fastapi_app
