from __future__ import annotations

import os

from google import genai
from google.genai import types

_client: genai.Client | None = None


def get_gemini_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
    return _client


def env_model_or(env_key: str, fallback: str) -> str:
    """Like getenv for model names, but empty or whitespace-only counts as unset."""
    v = os.getenv(env_key)
    if v is None:
        return fallback
    s = v.strip()
    return s if s else fallback


def get_gemini_model() -> str:
    return env_model_or("GEMINI_MODEL", "gemini-2.5-flash")


def gemini_thinking_disabled() -> types.ThinkingConfig:
    """Disable Gemini 2.5+ extended thinking for predictable streaming and `.text` extraction."""
    return types.ThinkingConfig(thinking_budget=0)


def streaming_chunk_text(chunk) -> str:
    """Text delta for one stream chunk; falls back to parts if `.text` is empty."""
    try:
        t = getattr(chunk, "text", None)
        if t:
            return t
    except (ValueError, AttributeError):
        pass
    try:
        cand = chunk.candidates[0]
        if not cand.content or not cand.content.parts:
            return ""
        parts: list[str] = []
        for p in cand.content.parts:
            if getattr(p, "thought", None) is True:
                continue
            tx = getattr(p, "text", None)
            if isinstance(tx, str) and tx:
                parts.append(tx)
        return "".join(parts)
    except (IndexError, AttributeError, TypeError):
        return ""
