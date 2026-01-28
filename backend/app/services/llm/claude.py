"""Claude LLM provider implementation."""

from collections.abc import AsyncIterator

import anthropic

from app.config import settings
from app.services.llm.base import LLMError, LLMProvider


class ClaudeProvider(LLMProvider):
    """LLM provider that connects to Anthropic's Claude API.

    Uses the Anthropic SDK with ANTHROPIC_API_KEY for text generation.
    """

    # Default model to use for Claude API
    DEFAULT_MODEL = "claude-sonnet-4-20250514"

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        timeout: int | None = None,
    ) -> None:
        """Initialize the Claude provider.

        Args:
            api_key: Anthropic API key. Defaults to settings.ANTHROPIC_API_KEY.
            model: Model name to use. Defaults to claude-sonnet-4-20250514.
            timeout: Request timeout in seconds. Defaults to settings.LLM_TIMEOUT.

        Raises:
            LLMError: If API key is not configured.
        """
        self.api_key = api_key or settings.ANTHROPIC_API_KEY
        if not self.api_key:
            raise LLMError("Claude API key not configured")

        self.model = model or self.DEFAULT_MODEL
        self.timeout = timeout or settings.LLM_TIMEOUT

        # Initialize the Anthropic client
        self._client = anthropic.Anthropic(
            api_key=self.api_key,
            timeout=float(self.timeout),
        )
        self._async_client = anthropic.AsyncAnthropic(
            api_key=self.api_key,
            timeout=float(self.timeout),
        )

    # Default LLM generation settings
    DEFAULT_TEMPERATURE = 0.7
    DEFAULT_MAX_TOKENS = 4096

    def generate(
        self,
        prompt: str,
        *,
        temperature: float | None = None,
        max_tokens: int | None = None,
        timeout: float | None = None,
    ) -> str:
        """Generate a response using Claude's messages.create API.

        Args:
            prompt: The input prompt to send to the LLM.
            temperature: Optional temperature for response randomness (0.0-1.0).
            max_tokens: Optional maximum tokens in the response.
            timeout: Optional timeout in seconds for this specific request.

        Returns:
            The generated text response.

        Raises:
            LLMError: If the API call fails or times out.
        """
        # Use provided values or fall back to defaults
        actual_temperature = temperature if temperature is not None else self.DEFAULT_TEMPERATURE
        actual_max_tokens = max_tokens if max_tokens is not None else self.DEFAULT_MAX_TOKENS
        actual_timeout = timeout if timeout is not None else self.timeout

        try:
            # Create a client with the specific timeout for this request
            client = anthropic.Anthropic(
                api_key=self.api_key,
                timeout=float(actual_timeout),
            )

            message = client.messages.create(
                model=self.model,
                max_tokens=actual_max_tokens,
                temperature=actual_temperature,
                messages=[
                    {"role": "user", "content": prompt}
                ],
            )
            # Extract text from the response content blocks
            text_blocks = [
                block.text
                for block in message.content
                if hasattr(block, "text")
            ]
            return "".join(text_blocks)
        except anthropic.AuthenticationError:
            raise LLMError("Claude API key is invalid")
        except anthropic.RateLimitError:
            raise LLMError("Claude API rate limit exceeded")
        except anthropic.APITimeoutError:
            raise LLMError("Claude API request timed out")
        except anthropic.APIConnectionError:
            raise LLMError("Claude API connection failed")
        except anthropic.APIStatusError as e:
            raise LLMError(f"Claude API error: {e.status_code}")
        except Exception as e:
            raise LLMError(f"Claude error: {str(e)}")

    async def stream(self, prompt: str) -> AsyncIterator[str]:
        """Stream a response using Claude's messages.stream API.

        Args:
            prompt: The input prompt to send to the LLM.

        Yields:
            Chunks of the generated text response.

        Raises:
            LLMError: If the API call fails.
        """
        try:
            async with self._async_client.messages.stream(
                model=self.model,
                max_tokens=4096,
                messages=[
                    {"role": "user", "content": prompt}
                ],
            ) as stream:
                async for text in stream.text_stream:
                    if text:
                        yield text
        except anthropic.AuthenticationError:
            raise LLMError("Claude API key is invalid")
        except anthropic.RateLimitError:
            raise LLMError("Claude API rate limit exceeded")
        except anthropic.APITimeoutError:
            raise LLMError("Claude API request timed out")
        except anthropic.APIConnectionError:
            raise LLMError("Claude API connection failed")
        except anthropic.APIStatusError as e:
            raise LLMError(f"Claude API error: {e.status_code}")
        except Exception as e:
            raise LLMError(f"Claude error: {str(e)}")
