"""Server-side ElevenLabs text-to-speech (keeps API key off the client)."""

from __future__ import annotations

import os

import httpx
from fastapi import HTTPException

ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech"


async def synthesize_elevenlabs_mp3(text: str) -> bytes:
    api_key = os.getenv("ELEVENLABS_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="Text-to-speech is not configured (set ELEVENLABS_API_KEY in backend/.env).",
        )

    voice_id = (os.getenv("ELEVENLABS_VOICE_ID") or "21m00Tcm4TlvDq8ikWAM").strip()
    # Flash is the usual entry model; multilingual v2 + default mp3 tier can hit plan/format limits on free API.
    model_id = os.getenv("ELEVENLABS_MODEL_ID", "eleven_flash_v2_5").strip()

    # Lowest MP3 tier avoids Creator+ output_format restrictions from the default mp3_44100_128.
    url = f"{ELEVENLABS_TTS_URL}/{voice_id}?output_format=mp3_22050_32"
    headers = {
        "xi-api-key": api_key,
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
    }
    body = {"text": text, "model_id": model_id}

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(url, json=body, headers=headers)

    if response.status_code != 200:
        raw = (response.text or response.reason_phrase)[:800]
        extra = ""
        if response.status_code == 402:
            try:
                err = response.json()
                inner = err.get("detail") if isinstance(err, dict) else None
                if isinstance(inner, dict) and inner.get("code") == "paid_plan_required":
                    extra = (
                        " If you are already on a premade voice (e.g. Rachel), ElevenLabs may require a "
                        "paid plan for API access on your account. Try ELEVENLABS_MODEL_ID=eleven_flash_v2_5 "
                        "and output_format=mp3_22050_32 (already the app default), or use the app’s "
                        "browser read-aloud fallback."
                    )
            except Exception:
                pass
        raise HTTPException(
            status_code=502,
            detail=f"ElevenLabs error ({response.status_code}): {raw}{extra}",
        )

    return response.content
