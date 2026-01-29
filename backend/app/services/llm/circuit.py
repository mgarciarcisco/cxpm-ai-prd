import base64
import time
from pathlib import Path

import requests

from app.config import settings


class CircuitProvider:
    """LLM provider that connects to Cisco's Circuit API.
    
    This provider automatically manages OAuth2 access tokens, including
    caching and automatic refresh when tokens expire.
    """

    def __init__(self, client_id: str | None = None, client_secret: str | None = None, app_key: str | None = None):
        """Initialize the Circuit provider.

        Args:
            client_id: Cisco's Circuit client id. If not provided, reads from circuit.key file.
            client_secret: Cisco's Circuit client secret. If not provided, reads from circuit.key file.
            app_key: Cisco's Circuit app key. If not provided, reads from circuit.key file.
        """
        # If credentials provided, use them directly
        if client_id and client_secret:
            self.client_id = client_id
            self.client_secret = client_secret
            self.app_key = app_key
        else:
            # Read credentials from circuit.key file
            key_file_path = Path(__file__).parent.parent.parent / "circuit.key"
            credentials = self._load_credentials_from_file(key_file_path)
            self.client_id = credentials.get('CLIENT_ID')
            self.client_secret = credentials.get('CLIENT_SECRET')
            self.app_key = credentials.get('APP_KEY')
        if not self.client_id or not self.client_secret or not self.app_key :
            raise ValueError("Circuit client id and client secret and app key not configured")
        

        self.cisco_oauth2_url = settings.CISCO_OAUTH2_URL
        # Load Circuit API configuration from environment settings
        self.model = settings.CIRCUIT_MODEL
        # Replace {model} placeholder in base URL with actual model name
        self.base_url = settings.CIRCUIT_BASE_URL.replace("{model}", self.model)
        
        # Token cache - private attributes
        self._access_token: str | None = None
        self._token_expires_at: float = 0.0

    def _load_credentials_from_file(self, file_path: Path) -> dict[str, str]:
        """Load credentials from the circuit.key file.

        Args:
            file_path: Path to the circuit.key file.

        Returns:
            Dictionary with CLIENT_ID and CLIENT_SECRET.

        Raises:
            FileNotFoundError: If the circuit.key file doesn't exist.
            ValueError: If the file format is invalid.
        """
        if not file_path.exists():
            raise FileNotFoundError(f"Circuit key file not found at {file_path}")
        
        credentials = {}
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith('#'):
                        continue  # Skip empty lines and comments
                    
                    if '=' in line:
                        key, value = line.split('=', 1)
                        key = key.strip()
                        value = value.strip()
                        credentials[key] = value
        except Exception as e:
            raise ValueError(f"Failed to parse circuit.key file: {str(e)}") from e
        
        return credentials


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
    
    def generate(self, system_prompt: str, user_prompt: str) -> dict:
        """Generate a chat completion using Cisco's Circuit AI API.
        
        Args:
            system_prompt: The system message that sets the context/behavior.
            user_prompt: The user message containing the actual prompt/question.
        
        Returns:
            The API response as a dictionary containing the completion results.
            
        Raises:
            requests.HTTPError: If the API request fails.
            ValueError: If required parameters are missing.
        """
        if not system_prompt or not user_prompt:
            raise ValueError("system_prompt and user_prompt are required")
        
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
            response = requests.post(url, headers=headers, json=payload, timeout=60)
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