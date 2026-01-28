"""Abstract base class for LLM providers."""

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator


class LLMError(Exception):
    """Exception raised when LLM operations fail."""

    pass


class LLMProvider(ABC):
    """Abstract base class for LLM providers.

    Defines the interface that all LLM provider implementations must follow.
    """

    @abstractmethod
    def generate(
        self,
        prompt: str,
        *,
        temperature: float | None = None,
        max_tokens: int | None = None,
        timeout: float | None = None,
    ) -> str:
        """Generate a response for the given prompt.

        Args:
            prompt: The input prompt to send to the LLM.
            temperature: Optional temperature for response randomness (0.0-1.0).
            max_tokens: Optional maximum tokens in the response.
            timeout: Optional timeout in seconds for this specific request.

        Returns:
            The generated text response.

        Raises:
            LLMError: If the generation fails or times out.
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
