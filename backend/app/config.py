"""Application configuration using pydantic-settings."""


from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database
    DATABASE_URL: str = "sqlite:///./cxpm.db"

    # Ollama LLM settings
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2"

    # Claude API (optional fallback)
    ANTHROPIC_API_KEY: str | None = None

    # File upload limits
    MAX_FILE_SIZE_KB: int = 50

    # LLM settings
    LLM_TIMEOUT: int = 60  # seconds
    LLM_MAX_RETRIES: int = 1

    # Chunking settings
    CHUNK_SIZE_CHARS: int = 4000

    class Config:
        env_file = ".env"


settings = Settings()
