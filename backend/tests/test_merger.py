"""Tests for the merge suggestion service."""

from unittest.mock import patch, MagicMock

import pytest

from app.services.merger import suggest_merge, MergeError
from app.services.llm import LLMError


class MockLLMProvider:
    """Mock LLM provider for testing."""

    def __init__(self, response: str):
        self.response = response
        self.generate_called = False
        self.prompt_received: str | None = None

    def generate(self, prompt: str) -> str:
        self.generate_called = True
        self.prompt_received = prompt
        return self.response


class FailingLLMProvider:
    """Mock LLM provider that always fails."""

    def __init__(self, error_message: str = "LLM unavailable"):
        self.error_message = error_message

    def generate(self, prompt: str) -> str:
        raise LLMError(self.error_message)


def test_successful_merge_suggestion() -> None:
    """Test that suggest_merge returns merged text for valid inputs."""
    existing = "Users must be able to log in with email and password"
    new = "The system should support secure authentication with password requirements of at least 8 characters"
    expected_merged = "Users must be able to log in with email and password, with passwords requiring at least 8 characters for security"

    mock_provider = MockLLMProvider(expected_merged)

    with patch("app.services.merger.get_provider", return_value=mock_provider):
        result = suggest_merge(existing, new)

    assert result == expected_merged
    assert mock_provider.generate_called
    assert mock_provider.prompt_received is not None
    assert existing in mock_provider.prompt_received
    assert new in mock_provider.prompt_received


def test_merge_with_mocked_llm_response() -> None:
    """Test merge suggestion with mocked LLM returning specific response."""
    existing = "Dashboard should display key metrics"
    new = "The dashboard needs to show user activity, sales figures, and inventory levels"
    mocked_response = "Dashboard should display key metrics including user activity, sales figures, and inventory levels"

    mock_provider = MockLLMProvider(mocked_response)

    with patch("app.services.merger.get_provider", return_value=mock_provider):
        result = suggest_merge(existing, new)

    assert result == mocked_response
    # Verify the prompt contains both inputs
    assert mock_provider.prompt_received is not None
    assert "Dashboard should display key metrics" in mock_provider.prompt_received
    assert "user activity, sales figures" in mock_provider.prompt_received


def test_merge_strips_markdown_code_blocks() -> None:
    """Test that markdown code blocks are stripped from LLM response."""
    existing = "System should log errors"
    new = "All errors must be logged with timestamps"
    merged_text = "System should log all errors with timestamps"

    # Wrap the response in markdown code blocks
    markdown_response = f"```\n{merged_text}\n```"

    mock_provider = MockLLMProvider(markdown_response)

    with patch("app.services.merger.get_provider", return_value=mock_provider):
        result = suggest_merge(existing, new)

    assert result == merged_text


def test_merge_strips_json_code_blocks() -> None:
    """Test that json code blocks are stripped from LLM response."""
    existing = "API should return JSON"
    new = "All endpoints return JSON responses"
    merged_text = "API endpoints should return JSON responses"

    # Wrap the response in json code blocks
    json_response = f"```json\n{merged_text}\n```"

    mock_provider = MockLLMProvider(json_response)

    with patch("app.services.merger.get_provider", return_value=mock_provider):
        result = suggest_merge(existing, new)

    assert result == merged_text


def test_llm_failure_raises_merge_error() -> None:
    """Test that LLM failure raises MergeError."""
    existing = "Some requirement"
    new = "Another requirement"

    failing_provider = FailingLLMProvider("Connection refused")

    with patch("app.services.merger.get_provider", return_value=failing_provider):
        with pytest.raises(MergeError) as exc_info:
            suggest_merge(existing, new)

    assert "LLM error" in str(exc_info.value) or "failed" in str(exc_info.value).lower()


def test_empty_llm_response_raises_merge_error() -> None:
    """Test that empty LLM response raises MergeError."""
    existing = "Some requirement"
    new = "Another requirement"

    # Mock LLM returning empty string
    mock_provider = MockLLMProvider("")

    with patch("app.services.merger.get_provider", return_value=mock_provider):
        with pytest.raises(MergeError) as exc_info:
            suggest_merge(existing, new)

    assert "empty response" in str(exc_info.value).lower()


def test_whitespace_only_response_raises_merge_error() -> None:
    """Test that whitespace-only LLM response raises MergeError."""
    existing = "Some requirement"
    new = "Another requirement"

    # Mock LLM returning only whitespace
    mock_provider = MockLLMProvider("   \n\t  ")

    with patch("app.services.merger.get_provider", return_value=mock_provider):
        with pytest.raises(MergeError) as exc_info:
            suggest_merge(existing, new)

    assert "empty response" in str(exc_info.value).lower()


def test_llm_retry_on_failure() -> None:
    """Test that LLM failure triggers retry before raising error."""
    existing = "Requirement A"
    new = "Requirement B"

    call_count = 0

    class FailingThenSucceedingProvider:
        def generate(self, prompt: str) -> str:
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise LLMError("First attempt failed")
            return "Merged requirement A and B"

    with patch("app.services.merger.get_provider", return_value=FailingThenSucceedingProvider()):
        result = suggest_merge(existing, new)

    assert result == "Merged requirement A and B"
    assert call_count == 2  # First failed, second succeeded


def test_llm_max_retries_exhausted() -> None:
    """Test that MergeError is raised after max retries are exhausted."""
    existing = "Requirement X"
    new = "Requirement Y"

    call_count = 0

    class AlwaysFailingProvider:
        def generate(self, prompt: str) -> str:
            nonlocal call_count
            call_count += 1
            raise LLMError(f"Attempt {call_count} failed")

    with patch("app.services.merger.get_provider", return_value=AlwaysFailingProvider()):
        with patch("app.services.merger.settings") as mock_settings:
            mock_settings.LLM_MAX_RETRIES = 2  # Allow 2 retries (3 total attempts)
            with pytest.raises(MergeError) as exc_info:
                suggest_merge(existing, new)

    assert "failed" in str(exc_info.value).lower()
    assert call_count == 3  # 1 initial + 2 retries


def test_unexpected_exception_raises_merge_error() -> None:
    """Test that unexpected exceptions are wrapped in MergeError."""
    existing = "Some requirement"
    new = "Another requirement"

    class UnexpectedErrorProvider:
        def generate(self, prompt: str) -> str:
            raise RuntimeError("Unexpected internal error")

    with patch("app.services.merger.get_provider", return_value=UnexpectedErrorProvider()):
        with pytest.raises(MergeError) as exc_info:
            suggest_merge(existing, new)

    assert "Unexpected error" in str(exc_info.value) or "failed" in str(exc_info.value).lower()


def test_prompt_template_loading() -> None:
    """Test that the prompt template is loaded and populated correctly."""
    existing = "Existing content here"
    new = "New content here"
    merged_result = "Merged content"

    mock_provider = MockLLMProvider(merged_result)

    with patch("app.services.merger.get_provider", return_value=mock_provider):
        suggest_merge(existing, new)

    # Verify the prompt contains the template structure and inputs
    prompt = mock_provider.prompt_received
    assert prompt is not None
    assert "EXISTING REQUIREMENT:" in prompt
    assert "NEW ITEM:" in prompt
    assert existing in prompt
    assert new in prompt


def test_response_whitespace_trimming() -> None:
    """Test that response whitespace is properly trimmed."""
    existing = "Requirement one"
    new = "Requirement two"
    merged_text = "Merged requirements"

    # Response with extra whitespace
    response_with_whitespace = f"  \n  {merged_text}  \n  "

    mock_provider = MockLLMProvider(response_with_whitespace)

    with patch("app.services.merger.get_provider", return_value=mock_provider):
        result = suggest_merge(existing, new)

    assert result == merged_text
