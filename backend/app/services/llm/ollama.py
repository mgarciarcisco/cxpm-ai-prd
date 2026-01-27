"""Ollama LLM provider implementation."""

import json
from collections.abc import AsyncIterator

import httpx

from app.config import settings
from app.services.llm.base import LLMError, LLMProvider


class OllamaProvider(LLMProvider):
    """LLM provider that connects to a local Ollama instance.

    Uses the Ollama API at OLLAMA_BASE_URL for text generation.
    """

    def __init__(
        self,
        base_url: str | None = None,
        model: str | None = None,
        timeout: int | None = None,
    ) -> None:
        """Initialize the Ollama provider.

        Args:
            base_url: Ollama API base URL. Defaults to settings.OLLAMA_BASE_URL.
            model: Model name to use. Defaults to settings.OLLAMA_MODEL.
            timeout: Request timeout in seconds. Defaults to settings.LLM_TIMEOUT.
        """
        self.base_url = base_url or settings.OLLAMA_BASE_URL
        self.model = model or settings.OLLAMA_MODEL
        self.timeout = timeout or settings.LLM_TIMEOUT

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
        """Generate a response using Ollama's /api/generate endpoint.

        Args:
            prompt: The input prompt to send to the LLM.
            temperature: Optional temperature for response randomness (0.0-1.0).
            max_tokens: Optional maximum tokens in the response (num_predict in Ollama).
            timeout: Optional timeout in seconds for this specific request.

        Returns:
            The generated text response.

        Raises:
            LLMError: If Ollama is not available, generation fails, or times out.
        """
        # Use provided values or fall back to defaults
        actual_temperature = temperature if temperature is not None else self.DEFAULT_TEMPERATURE
        actual_max_tokens = max_tokens if max_tokens is not None else self.DEFAULT_MAX_TOKENS
        actual_timeout = timeout if timeout is not None else self.timeout

        url = f"{self.base_url}/api/generate"
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": actual_temperature,
                "num_predict": actual_max_tokens,  # Ollama uses num_predict for max tokens
            },
        }

        try:
            with httpx.Client(timeout=actual_timeout) as client:
                response = client.post(url, json=payload)
                response.raise_for_status()
                data = response.json()
                return str(data.get("response", ""))
        except httpx.ConnectError:
            raise LLMError("Ollama not available")
        except httpx.TimeoutException:
            raise LLMError("Ollama request timed out")
        except httpx.HTTPStatusError as e:
            raise LLMError(f"Ollama request failed: {e.response.status_code}")
        except Exception as e:
            raise LLMError(f"Ollama error: {str(e)}")

    async def stream(self, prompt: str) -> AsyncIterator[str]:
        """Stream a response using Ollama's /api/generate endpoint.

        Args:
            prompt: The input prompt to send to the LLM.

        Yields:
            Chunks of the generated text response.

        Raises:
            LLMError: If Ollama is not available or streaming fails.
        """
        url = f"{self.base_url}/api/generate"
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": True,
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                async with client.stream("POST", url, json=payload) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if line:
                            try:
                                data = json.loads(line)
                                chunk = data.get("response", "")
                                if chunk:
                                    yield chunk
                            except json.JSONDecodeError:
                                continue
        except httpx.ConnectError:
            raise LLMError("Ollama not available")
        except httpx.TimeoutException:
            raise LLMError("Ollama request timed out")
        except httpx.HTTPStatusError as e:
            raise LLMError(f"Ollama request failed: {e.response.status_code}")
        except Exception as e:
            raise LLMError(f"Ollama error: {str(e)}")
