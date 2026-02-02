"""Circuit LLM provider implementation."""

import base64
import logging
import time
from collections.abc import AsyncIterator

import requests

from app.config import settings
from app.services.llm.base import LLMError, LLMProvider

logger = logging.getLogger(__name__)


class CircuitProvider(LLMProvider):
    """LLM provider that connects to Cisco's Circuit API.

    This provider automatically manages OAuth2 access tokens, including
    caching and automatic refresh when tokens expire.
    """

    def __init__(
        self,
        client_id: str | None = None,
        client_secret: str | None = None,
        app_key: str | None = None,
    ):
        """Initialize the Circuit provider.

        Args:
            client_id: Cisco's Circuit client id. Defaults to settings.CIRCUIT_CLIENT_ID.
            client_secret: Cisco's Circuit client secret. Defaults to settings.CIRCUIT_CLIENT_SECRET.
            app_key: Cisco's Circuit app key. Defaults to settings.CIRCUIT_APP_KEY.
        """
        self.client_id = client_id or settings.CIRCUIT_CLIENT_ID
        self.client_secret = client_secret or settings.CIRCUIT_CLIENT_SECRET
        self.app_key = app_key or settings.CIRCUIT_APP_KEY

        if not self.client_id or not self.client_secret or not self.app_key:
            raise ValueError(
                "Circuit credentials not configured. "
                "Set CIRCUIT_CLIENT_ID, CIRCUIT_CLIENT_SECRET, and CIRCUIT_APP_KEY in .env"
            )


        self.cisco_oauth2_url = settings.CISCO_OAUTH2_URL
        # Load Circuit API configuration from environment settings
        self.model = settings.CIRCUIT_MODEL
        # Replace {model} placeholder in base URL with actual model name
        self.base_url = settings.CIRCUIT_BASE_URL.replace("{model}", self.model)

        # Token cache - private attributes
        self._access_token: str | None = None
        self._token_expires_at: float = 0.0

    # Default LLM generation settings
    DEFAULT_TEMPERATURE = 0.7
    DEFAULT_MAX_TOKENS = 4096
    DEFAULT_SYSTEM_PROMPT = "You are a helpful AI assistant."

    def generate(
        self,
        prompt: str,
        *,
        temperature: float | None = None,
        max_tokens: int | None = None,
        timeout: float | None = None,
    ) -> str:
        """Generate a response using Circuit's chat completion API.

        Args:
            prompt: The input prompt to send to the LLM (used as user message).
            temperature: Optional temperature for response randomness (0.0-1.0).
            max_tokens: Optional maximum tokens in the response.
            timeout: Optional timeout in seconds for this specific request.

        Returns:
            The generated text response.

        Raises:
            LLMError: If the API call fails or times out.
        """
        actual_timeout = timeout if timeout is not None else settings.LLM_TIMEOUT
        prompt_preview = prompt[:100] + "..." if len(prompt) > 100 else prompt
        logger.info(f"[LLM] CircuitProvider.generate() called - model={self.model}, prompt_len={len(prompt)}")
        logger.debug(f"[LLM] CircuitProvider prompt preview: {prompt_preview}")

        try:
            response = self._generate_with_system(
                system_prompt=self.DEFAULT_SYSTEM_PROMPT,
                user_prompt=prompt,
                timeout=actual_timeout,
            )
            # Extract text from the response
            choices = response.get("choices", [])
            if choices:
                return choices[0].get("message", {}).get("content", "")
            return ""
        except requests.RequestException as e:
            raise LLMError(f"Circuit API error: {str(e)}")
        except Exception as e:
            raise LLMError(f"Circuit error: {str(e)}")

    async def stream(self, prompt: str) -> AsyncIterator[str]:
        """Stream a response using Circuit's chat completion API.

        Note: Circuit API may not support streaming. This implementation
        falls back to returning the full response as a single chunk.

        Args:
            prompt: The input prompt to send to the LLM.

        Yields:
            Chunks of the generated text response.

        Raises:
            LLMError: If the API call fails.
        """
        try:
            # Circuit doesn't support streaming, so we get the full response
            # and yield it as a single chunk
            response = self.generate(prompt)
            yield response
        except LLMError:
            raise
        except Exception as e:
            raise LLMError(f"Circuit streaming error: {str(e)}")

    def get_access_token(self) -> str:
        """Get a valid access token, refreshing if necessary.
        
        This method automatically handles token caching and refresh.
        If the cached token is still valid, it returns it immediately.
        If the token has expired or doesn't exist, it requests a new one.
        
        Returns:
            A valid OAuth2 access token.
            
        Raises:
            requests.HTTPError: If token request fails.
        """
        if self._is_token_valid():
            return self._access_token

        # Token expired or doesn't exist - request a new one
        self._refresh_token()
        return self._access_token

    def _is_token_valid(self) -> bool:
        """Check if the cached token is still valid.
        
        Returns:
            True if token exists and hasn't expired, False otherwise.
        """
        if not self._access_token:
            return False

        # Check if token hasn't expired (with small buffer)
        return time.time() < self._token_expires_at

    def _refresh_token(self) -> None:
        """Request a new access token from Cisco's Circuit API.
        
        This is a command method that modifies internal state but doesn't return anything.
        Updates both _access_token and _token_expires_at.
        
        Raises:
            requests.HTTPError: If the token request fails.
        """
        url = self.cisco_oauth2_url
        payload = "grant_type=client_credentials"

        # Encode credentials for Basic Auth
        credentials = f'{self.client_id}:{self.client_secret}'
        encoded_credentials = base64.b64encode(credentials.encode('utf-8')).decode('utf-8')

        headers = {
            "Accept": "*/*",
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": f"Basic {encoded_credentials}"
        }

        response = requests.post(url, headers=headers, data=payload)
        response.raise_for_status()  # Raise exception for HTTP errors

        token_data = response.json()

        # Store token and expiration (with 60 second buffer to avoid edge cases)
        self._access_token = token_data.get('access_token')
        expires_in = token_data.get('expires_in', 3600)  # Default 1 hour
        self._token_expires_at = time.time() + expires_in - 60

    def invalidate_token(self) -> None:
        """Manually invalidate the cached token.
        
        Useful for testing or when you know the token has been revoked.
        The next call to get_access_token() will request a fresh token.
        """
        self._access_token = None
        self._token_expires_at = 0.0

    def _generate_with_system(
        self,
        system_prompt: str,
        user_prompt: str,
        timeout: float | None = None,
    ) -> dict:
        """Generate a chat completion using Cisco's Circuit AI API.

        This is the internal method that supports separate system/user prompts.

        Args:
            system_prompt: The system message that sets the context/behavior.
            user_prompt: The user message containing the actual prompt/question.
            timeout: Optional timeout in seconds.

        Returns:
            The API response as a dictionary containing the completion results.

        Raises:
            requests.HTTPError: If the API request fails.
            ValueError: If required parameters are missing.
        """
        if not system_prompt or not user_prompt:
            raise ValueError("system_prompt and user_prompt are required")

        actual_timeout = timeout if timeout is not None else settings.LLM_TIMEOUT

        # Get a valid access token (will refresh if needed)
        access_token = self.get_access_token()

        # Use the pre-configured base URL (already has model in it)
        url = self.base_url

        # Prepare headers
        headers = {
            "api-key": access_token,
            "Content-Type": "application/json"
        }

        # Prepare the request payload
        payload = {
            "user": f'{{"appkey": "{self.app_key}"}}',
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
        }


        try:
            # Send POST request to Circuit AI API
            response = requests.post(url, headers=headers, json=payload, timeout=actual_timeout)
            response.raise_for_status()  # Raise exception for HTTP errors

            # Return the JSON response
            return response.json()

        except requests.HTTPError as e:
            # Re-raise with more context
            error_detail = ""
            try:
                error_detail = e.response.json() if e.response else ""
            except Exception:
                error_detail = e.response.text if e.response else str(e)

            raise requests.HTTPError(
                f"Circuit AI API request failed: {e}. Details: {error_detail}"
            ) from e
        except requests.RequestException as e:
            # Handle other request errors (timeout, connection, etc.)
            raise requests.RequestException(
                f"Circuit AI API request error: {str(e)}"
            ) from e
