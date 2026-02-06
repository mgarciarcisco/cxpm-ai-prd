"""Application configuration using pydantic-settings."""

from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Cisco OAuth2 configuration
    CISCO_OAUTH2_URL: str = "https://id.cisco.com/oauth2/default/v1/token"

    # Database
    DATABASE_URL: str = "sqlite:///./cxpm.db"

    # Circuit API (Cisco's AI platform - primary LLM provider)
    CIRCUIT_BASE_URL: str = "https://chat-ai.cisco.com/openai/deployments/{model}/chat/completions"
    CIRCUIT_MODEL: str = "gpt-4.1"
    CIRCUIT_CLIENT_ID: Optional[str] = None
    CIRCUIT_CLIENT_SECRET: Optional[str] = None
    CIRCUIT_APP_KEY: Optional[str] = None

    # JIRA Configuration (optional - only required when using Jira API integration)
    JIRA_BASE_URL: str = "https://cisco-cxe.atlassian.net/"
    JIRA_API_KEY: Optional[str] = None
    JIRA_USER: Optional[str] = None
    

    # Ollama LLM settings (fallback)
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2"

    # File upload limits
    MAX_FILE_SIZE_KB: int = 50

    # LLM settings
    LLM_TIMEOUT: int = 60  # seconds
    LLM_MAX_RETRIES: int = 1

    # Chunking settings
    CHUNK_SIZE_CHARS: int = 4000

    # CORS
    CORS_ORIGINS: str = ""

    # JWT Authentication
    JWT_SECRET_KEY: str = "dev-secret-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_HOURS: int = 24

    class Config:
        env_file = ".env"
        extra = "ignore"  # Ignore extra fields in .env file


settings = Settings()
