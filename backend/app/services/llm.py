"""LLM provider abstraction with a free, local-first default.

Resolution order (when ``LLM_PROVIDER=auto``):
  1. **Ollama** — a local model with no API key (default). Detected by pinging the
     Ollama server; pull a model first, e.g. ``ollama pull llama3.2:1b``.
  2. **Claude** — Anthropic API, only if ``ANTHROPIC_API_KEY`` is set (optional, paid).
  3. **None** — callers fall back to the deterministic extractive answerer.

Ollama is called over plain HTTP via the standard library, so there is no extra
dependency to install on the Python side.
"""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from collections.abc import Iterator
from functools import lru_cache

from app.core.config import settings

# cache the (somewhat expensive) Ollama reachability check for a short window so
# health/chat calls don't ping the server constantly
_ollama_checked_at = 0.0
_ollama_ok = False
_OLLAMA_TTL = 30.0


_ollama_models: list[str] = []


def _refresh_ollama() -> None:
    """Refresh reachability + the list of pulled models (cached for a short window)."""
    global _ollama_checked_at, _ollama_ok, _ollama_models
    now = time.time()
    if now - _ollama_checked_at < _OLLAMA_TTL:
        return
    _ollama_checked_at = now
    try:
        req = urllib.request.Request(f"{settings.ollama_base_url}/api/tags")
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        _ollama_models = [m.get("name", "") for m in data.get("models", [])]
        _ollama_ok = True
    except Exception:
        _ollama_ok = False
        _ollama_models = []


def _resolve_ollama_model() -> str | None:
    """Pick a usable Ollama model: the configured one if pulled, else a close match,
    else the first available. None if Ollama is down or has no models pulled."""
    _refresh_ollama()
    if not _ollama_ok or not _ollama_models:
        return None
    want = settings.ollama_model
    if want in _ollama_models:
        return want
    base = want.split(":")[0]
    for m in _ollama_models:
        if m.split(":")[0] == base:
            return m
    return _ollama_models[0]


@lru_cache(maxsize=1)
def _claude_client():
    if not settings.claude_key_set:
        return None
    try:
        import anthropic

        return anthropic.Anthropic(api_key=settings.anthropic_api_key)
    except Exception:
        return None


def active_provider() -> tuple[str | None, str | None]:
    """Return (provider, model) for the currently usable LLM, or (None, None)."""
    pref = settings.llm_provider.lower()
    if pref == "off":
        return None, None
    if pref in ("auto", "ollama"):
        model = _resolve_ollama_model()
        if model:
            return "ollama", model
    if pref in ("auto", "gemini") and settings.gemini_key_set:
        return "gemini", settings.gemini_model
    if pref in ("auto", "claude") and _claude_client() is not None:
        return "claude", settings.anthropic_model
    return None, None


def llm_available() -> bool:
    return active_provider()[0] is not None


def _ollama_chat(system: str, user: str, max_tokens: int) -> str | None:
    model = _resolve_ollama_model() or settings.ollama_model
    payload = json.dumps(
        {
            "model": model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "stream": False,
            "options": {"temperature": 0.2, "num_predict": max_tokens},
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        f"{settings.ollama_base_url}/api/chat",
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        return (data.get("message", {}).get("content") or "").strip() or None
    except Exception:
        return None


def _claude_chat(system: str, user: str, max_tokens: int) -> str | None:
    client = _claude_client()
    if client is None:
        return None
    try:
        resp = client.messages.create(
            model=settings.anthropic_model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        parts = [b.text for b in resp.content if getattr(b, "type", "") == "text"]
        return "\n".join(parts).strip() or None
    except Exception:
        return None


_GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"


def _gemini_body(system: str, user: str, max_tokens: int) -> bytes:
    return json.dumps(
        {
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "systemInstruction": {"parts": [{"text": system}]},
            # thinkingBudget 0 disables 2.5-flash "thinking" so the token budget
            # goes to the actual answer instead of internal reasoning.
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": max_tokens,
                "thinkingConfig": {"thinkingBudget": 0},
            },
        }
    ).encode("utf-8")


def _gemini_chat(system: str, user: str, max_tokens: int) -> str | None:
    if not settings.gemini_key_set:
        return None
    url = f"{_GEMINI_BASE}/{settings.gemini_model}:generateContent?key={settings.gemini_api_key}"
    req = urllib.request.Request(
        url, data=_gemini_body(system, user, max_tokens),
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        cands = data.get("candidates", [])
        if not cands:
            return None
        parts = cands[0].get("content", {}).get("parts", [])
        text = "".join(p.get("text", "") for p in parts).strip()
        return text or None
    except Exception:
        return None


def _gemini_stream(system: str, user: str, max_tokens: int) -> Iterator[str]:
    if not settings.gemini_key_set:
        return
    url = f"{_GEMINI_BASE}/{settings.gemini_model}:streamGenerateContent?alt=sse&key={settings.gemini_api_key}"
    req = urllib.request.Request(
        url, data=_gemini_body(system, user, max_tokens),
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            for raw in resp:
                line = raw.decode("utf-8").strip()
                if not line.startswith("data:"):
                    continue
                payload = line[5:].strip()
                if not payload or payload == "[DONE]":
                    continue
                try:
                    obj = json.loads(payload)
                    for cand in obj.get("candidates", []):
                        for p in cand.get("content", {}).get("parts", []):
                            piece = p.get("text", "")
                            if piece:
                                yield piece
                except Exception:
                    continue
    except Exception:
        return


def chat(system: str, user: str, max_tokens: int = 1024) -> str | None:
    """Single-turn completion via the active provider. None if unavailable/errors."""
    provider, _ = active_provider()
    if provider == "ollama":
        return _ollama_chat(system, user, max_tokens)
    if provider == "gemini":
        return _gemini_chat(system, user, max_tokens)
    if provider == "claude":
        return _claude_chat(system, user, max_tokens)
    return None


def _ollama_stream(system: str, user: str, max_tokens: int) -> Iterator[str]:
    model = _resolve_ollama_model() or settings.ollama_model
    payload = json.dumps(
        {
            "model": model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "stream": True,
            "options": {"temperature": 0.2, "num_predict": max_tokens},
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        f"{settings.ollama_base_url}/api/chat",
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            for raw in resp:
                line = raw.decode("utf-8").strip()
                if not line:
                    continue
                obj = json.loads(line)
                piece = obj.get("message", {}).get("content", "")
                if piece:
                    yield piece
                if obj.get("done"):
                    break
    except Exception:
        return


def _claude_stream(system: str, user: str, max_tokens: int) -> Iterator[str]:
    client = _claude_client()
    if client is None:
        return
    try:
        with client.messages.stream(
            model=settings.anthropic_model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
        ) as stream:
            for text in stream.text_stream:
                if text:
                    yield text
    except Exception:
        return


def chat_stream(system: str, user: str, max_tokens: int = 1024) -> Iterator[str]:
    """Yield answer tokens from the active provider. Empty iterator if unavailable."""
    provider, _ = active_provider()
    if provider == "ollama":
        yield from _ollama_stream(system, user, max_tokens)
    elif provider == "gemini":
        yield from _gemini_stream(system, user, max_tokens)
    elif provider == "claude":
        yield from _claude_stream(system, user, max_tokens)
