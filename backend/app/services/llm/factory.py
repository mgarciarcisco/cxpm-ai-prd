"""LLM provider factory."""

import logging

from app.config import settings
from app.services.llm.base import LLMError, LLMProvider
from app.services.llm.circuit import CircuitProvider

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


def get_provider() -> LLMProvider:
    """Get the LLM provider (Circuit).

    Returns:
        An LLMProvider instance (CircuitProvider).

    Raises:
        LLMError: If Circuit is not configured or unavailable.
    """
    if _is_circuit_available():
        try:
            provider = CircuitProvider()
            logger.info("[LLM Factory] Selected provider: CircuitProvider")
            return provider
        except Exception as e:
            logger.warning(f"[LLM Factory] CircuitProvider failed to initialize: {e}")

    logger.error("[LLM Factory] No LLM provider available!")
    raise LLMError(
        "No LLM available. Please configure Circuit credentials (CIRCUIT_CLIENT_ID, CIRCUIT_CLIENT_SECRET, CIRCUIT_APP_KEY)."
    )
