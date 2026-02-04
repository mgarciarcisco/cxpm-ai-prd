"""Merge suggestion service for combining conflicting requirements."""

from pathlib import Path

from app.config import settings
from app.services.llm import LLMError, get_provider

# Path to the merge suggestion prompt template
PROMPT_PATH = Path(__file__).parent.parent.parent / "prompts" / "suggest_merge_v1.txt"


class MergeError(Exception):
    """Exception raised when merge suggestion fails."""
    pass


def _load_prompt() -> str:
    """Load the merge suggestion prompt template from file.

    Returns:
        The prompt template string with {existing_content} and {new_content} placeholders.

    Raises:
        MergeError: If the prompt file cannot be loaded.
    """
    try:
        return PROMPT_PATH.read_text(encoding="utf-8")
    except Exception as e:
        raise MergeError(f"Failed to load merge suggestion prompt: {e}")


def _clean_response(response: str) -> str:
    """Clean the LLM response by removing any surrounding whitespace or markdown.

    Args:
        response: The raw LLM response string.

    Returns:
        The cleaned merged text string.
    """
    cleaned = response.strip()

    # Remove markdown code blocks if present
    if cleaned.startswith("```"):
        # Find the end of the opening fence
        first_newline = cleaned.find("\n")
        if first_newline != -1:
            cleaned = cleaned[first_newline + 1:]
        else:
            cleaned = cleaned[3:]

    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]

    return cleaned.strip()


def suggest_merge(existing: str, new: str) -> str:
    """Generate an AI-suggested merged text for combining two requirement statements.

    This function uses the LLM to suggest how to merge an existing requirement
    with a new meeting item that has been identified as a refinement or conflict.

    Args:
        existing: The content of the existing requirement.
        new: The content of the new meeting item.

    Returns:
        A string containing the suggested merged text.

    Raises:
        MergeError: If the merge suggestion fails after retries.
    """
    # Load the prompt template
    prompt_template = _load_prompt()

    # Build the prompt with the actual content
    prompt = prompt_template.replace("{existing_content}", existing)
    prompt = prompt.replace("{new_content}", new)

    max_attempts = settings.LLM_MAX_RETRIES + 1
    last_error: Exception | None = None

    for attempt in range(max_attempts):
        try:
            provider = get_provider()
            response = provider.generate(prompt, system_prompt="")
            merged_text = _clean_response(response)

            # Validate that we got some text back
            if not merged_text:
                raise MergeError("LLM returned empty response")

            return merged_text

        except LLMError as e:
            last_error = MergeError(f"LLM error: {e}")
            if attempt >= max_attempts - 1:
                break
            continue
        except MergeError:
            raise
        except Exception as e:
            last_error = MergeError(f"Unexpected error during merge suggestion: {e}")
            if attempt >= max_attempts - 1:
                break
            continue

    raise MergeError(
        f"Merge suggestion failed after {max_attempts} attempts: {last_error}"
    )
