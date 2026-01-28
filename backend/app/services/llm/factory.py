"""LLM provider factory with automatic fallback logic."""

import httpx

from app.config import settings
from app.services.llm.base import LLMError, LLMProvider
from app.services.llm.claude import ClaudeProvider
from app.services.llm.ollama import OllamaProvider


def _is_ollama_available() -> bool:
    """Check if Ollama is available by calling the /api/tags health check endpoint.

    Returns:
        True if Ollama is available and responding, False otherwise.
    """
    url = f"{settings.OLLAMA_BASE_URL}/api/tags"
    try:
        with httpx.Client(timeout=5.0) as client:
            response = client.get(url)
            response.raise_for_status()
            return True
    except Exception:
        return False


def get_provider() -> LLMProvider:
    """Get an LLM provider with automatic fallback.

    Tries Ollama first, then falls back to Claude if Ollama is unavailable.

    Returns:
        An LLMProvider instance (either OllamaProvider or ClaudeProvider).

    Raises:
        LLMError: If neither Ollama nor Claude is available.
    """
    # Try Ollama first
    if _is_ollama_available():
        return OllamaProvider()

    # Fall back to Claude if Ollama is unavailable
    if settings.ANTHROPIC_API_KEY:
        try:
            return ClaudeProvider()
        except LLMError:
            # ClaudeProvider raises LLMError if API key is invalid
            pass

    # Neither provider is available
    raise LLMError(
        "No LLM available. Please start Ollama or configure Claude API key."
    )
