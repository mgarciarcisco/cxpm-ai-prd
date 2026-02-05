"""LLM provider factory with automatic fallback logic."""

import logging

import httpx

from app.config import settings
from app.services.llm.base import LLMError, LLMProvider
from app.services.llm.circuit import CircuitProvider
from app.services.llm.ollama import OllamaProvider

logger = logging.getLogger(__name__)


def _is_circuit_available() -> bool:
    """Check if Circuit credentials are configured in settings.

    Returns:
        True if Circuit credentials are configured, False otherwise.
    """
    return bool(
        settings.CIRCUIT_CLIENT_ID
        and settings.CIRCUIT_CLIENT_SECRET
        and settings.CIRCUIT_APP_KEY
    )


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

    Tries Circuit first, then falls back to Ollama if Circuit is unavailable.

    Returns:
        An LLMProvider instance (either CircuitProvider or OllamaProvider).

    Raises:
        LLMError: If neither Circuit nor Ollama is available.
    """
    # Try Circuit first (Cisco's AI platform)
    if _is_circuit_available():
        try:
            provider = CircuitProvider()
            logger.info("[LLM Factory] Selected provider: CircuitProvider")
            return provider
        except Exception as e:
            logger.warning(f"[LLM Factory] CircuitProvider failed to initialize: {e}")

    # Fall back to Ollama if Circuit is unavailable
    if _is_ollama_available():
        logger.info("[LLM Factory] Selected provider: OllamaProvider (fallback)")
        return OllamaProvider()

    # Neither provider is available
    logger.error("[LLM Factory] No LLM provider available!")
    raise LLMError(
        "No LLM available. Please configure Circuit credentials or start Ollama."
    )
