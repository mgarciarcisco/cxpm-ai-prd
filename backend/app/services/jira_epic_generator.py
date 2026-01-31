"""JIRA Epic Generator service for creating JIRA Epics from requirements using LLM."""

from pathlib import Path

from app.services.llm.circuit import CircuitProvider

# Path to the JIRA Epic prompt template
PROMPTS_PATH = Path(__file__).parent.parent.parent / "prompts"
JIRA_EPIC_PROMPT_PATH = PROMPTS_PATH / "jira_epic.txt"

# LLM configuration for JIRA Epic generation
JIRA_EPIC_LLM_TIMEOUT = 300  # seconds (5 min for large requirements)
JIRA_EPIC_LLM_TEMPERATURE = 0.7
JIRA_EPIC_LLM_MAX_TOKENS = 8000


class JiraEpicGeneratorError(Exception):
    """Exception raised when JIRA Epic generation fails."""

    pass


class JiraEpicGenerator:
    """Service for generating JIRA Epics from requirements using LLM.

    This service reads requirements (up to 1GB of text) and uses Cisco's
    Circuit AI API to generate structured JIRA Epics following best practices.
    """

    def __init__(self) -> None:
        """Initialize the JIRA Epic Generator."""
        # Load the prompt template on initialization
        self._prompt_template = self._load_prompt_template()

    def _load_prompt_template(self) -> str:
        """Load the JIRA Epic prompt template from file.

        Returns:
            The prompt template content.

        Raises:
            JiraEpicGeneratorError: If the prompt template cannot be loaded.
        """
        try:
            with open(JIRA_EPIC_PROMPT_PATH, encoding="utf-8") as f:
                return f.read()
        except FileNotFoundError as e:
            raise JiraEpicGeneratorError(
                f"JIRA Epic prompt template not found at {JIRA_EPIC_PROMPT_PATH}"
            ) from e
        except Exception as e:
            raise JiraEpicGeneratorError(
                f"Failed to load JIRA Epic prompt template: {str(e)}"
            ) from e

    def create_jira_epic(self, requirements: str) -> str:
        """Generate a JIRA Epic from the provided requirements.

        This method takes a requirements document (up to 1GB) and uses Cisco's
        Circuit AI API to generate a structured JIRA Epic following the template
        format defined in the prompt.

        Args:
            requirements: The requirements document as a string (up to 1GB).
                Should contain stakeholder needs, goals, pain points, or
                any informal descriptions that need to be converted into
                a structured JIRA Epic.

        Returns:
            The generated JIRA Epic as a formatted string with sections:
            - Title
            - Description
            - Problem Statement
            - Target user roles
            - Data Sources
            - Business Rules and Error Handling
            - Response Example
            - Acceptance Criteria

        Raises:
            JiraEpicGeneratorError: If epic generation fails.
            ValueError: If requirements is empty or invalid.
        """
        # Validate input
        if not requirements or not requirements.strip():
            raise ValueError("Requirements cannot be empty")

        # Check size (1GB = 1,073,741,824 bytes)
        # Using UTF-8 encoding, approximate size in bytes
        requirements_size = len(requirements.encode("utf-8"))
        max_size = 1024 * 1024 * 1024  # 1 GB
        if requirements_size > max_size:
            raise ValueError(
                f"Requirements exceed maximum size of 1GB. "
                f"Provided: {requirements_size / (1024**3):.2f} GB"
            )

        # Initialize Circuit AI provider
        try:
            provider = CircuitProvider()
        except Exception as e:
            raise JiraEpicGeneratorError(
                f"Failed to initialize Circuit AI provider: {str(e)}"
            ) from e

        # Generate the JIRA Epic using Circuit AI
        # Use the prompt template as system prompt and requirements as user prompt
        try:
            response = provider.generate(
                system_prompt=self._prompt_template,
                user_prompt=requirements
            )

            # Extract the content from the response
            # Circuit API returns a dict with 'choices' array
            if not response or not isinstance(response, dict):
                raise JiraEpicGeneratorError("Circuit API returned invalid response")

            choices = response.get('choices', [])
            if not choices:
                raise JiraEpicGeneratorError("Circuit API returned no choices")

            message = choices[0].get('message', {})
            epic = message.get('content', '').strip()

            if not epic:
                raise JiraEpicGeneratorError("Circuit API returned empty content")

            return epic

        except JiraEpicGeneratorError:
            # Re-raise our custom errors
            raise
        except Exception as e:
            raise JiraEpicGeneratorError(
                f"Unexpected error during epic generation: {str(e)}"
            ) from e

