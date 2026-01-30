"""Application configuration using pydantic-settings."""


from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Cisco OAuth2 configuration
    CISCO_OAUTH2_URL: str = "https://id.cisco.com/oauth2/default/v1/token"

    # Database
    DATABASE_URL: str = "sqlite:///./cxpm.db"

    # Circuit API (Cisco's AI platform)
    CIRCUIT_BASE_URL: str = "https://chat-ai.cisco.com/openai/deployments/{model}/chat/completions"
    CIRCUIT_MODEL: str = "gpt-4.1"


    # JIRA Configuration
    JIRA_BASE_URL: str = "https://cisco-cxe.atlassian.net/"
    JIRA_API_KEY: str  # Required - set in .env file
    JIRA_USER: str  # Required - set in .env file
    

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
