"""Application configuration, loaded from environment / .env file."""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    app_name: str = "Synapse"
    app_version: str = "0.1.0"
    debug: bool = True

    # LLM provider selection: auto | ollama | gemini | claude | off
    # "auto" prefers a running local Ollama, then Gemini (if a key is set),
    # then Claude (if a key is set), then falls back to the extractive answerer.
    llm_provider: str = "auto"

    # Ollama (free, local, no API key) — https://ollama.com
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2:1b"  # lightweight; pull with: ollama pull llama3.2:1b

    # Google Gemini (free tier) — set GEMINI_API_KEY to enable hosted AI.
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"

    # Anthropic Claude (optional, paid)
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-opus-4-8"

    # Database
    database_url: str = "sqlite:///./synapse.db"

    # Auth (JWT). Override jwt_secret in production via the env var.
    jwt_secret: str = "dev-secret-change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # 7 days

    # Retrieval / chunking
    chunk_size: int = 900
    chunk_overlap: int = 150
    top_k: int = 6
    embedding_dim: int = 384

    # CORS — comma-separated list in the env var
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def claude_key_set(self) -> bool:
        return bool(self.anthropic_api_key.strip())

    @property
    def gemini_key_set(self) -> bool:
        return bool(self.gemini_api_key.strip())


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
