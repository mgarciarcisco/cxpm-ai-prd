"""Abstract base class for LLM providers."""

from abc import ABC, abstractmethod
from typing import AsyncIterator


class LLMError(Exception):
    """Exception raised when LLM operations fail."""

    pass


class LLMProvider(ABC):
    """Abstract base class for LLM providers.

    Defines the interface that all LLM provider implementations must follow.
    """

    @abstractmethod
    def generate(self, prompt: str) -> str:
        """Generate a response for the given prompt.

        Args:
            prompt: The input prompt to send to the LLM.

        Returns:
            The generated text response.

        Raises:
            LLMError: If the generation fails.
        """
        pass

    @abstractmethod
    async def stream(self, prompt: str) -> AsyncIterator[str]:
        """Stream a response for the given prompt.

        Args:
            prompt: The input prompt to send to the LLM.

        Yields:
            Chunks of the generated text response.

        Raises:
            LLMError: If the streaming fails.
        """
        pass
        # This yield is needed to make this an async generator
        # It will never be reached due to the abstract method, but makes mypy happy
        yield ""  # pragma: no cover
