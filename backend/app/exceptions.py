"""Custom exception classes for PRD and Stories generation."""


class PRDGenerationError(Exception):
    """Base exception for PRD generation errors."""
    pass


class NoRequirementsError(PRDGenerationError):
    """Raised when a project has no requirements for generation."""

    def __init__(self, project_id: str, message: str | None = None):
        self.project_id = project_id
        if message is None:
            message = f"Project {project_id} has no requirements to generate PRD/stories from"
        super().__init__(message)


class LLMResponseError(PRDGenerationError):
    """Raised when the LLM response is malformed or cannot be parsed."""

    def __init__(self, message: str, raw_response: str | None = None):
        self.raw_response = raw_response
        super().__init__(message)


class GenerationTimeoutError(PRDGenerationError):
    """Raised when PRD/story generation times out."""

    def __init__(self, timeout_seconds: int, message: str | None = None):
        self.timeout_seconds = timeout_seconds
        if message is None:
            message = f"Generation timed out after {timeout_seconds} seconds"
        super().__init__(message)


class GenerationCancelledError(PRDGenerationError):
    """Raised when generation is cancelled by the user."""

    def __init__(self, generation_id: str, message: str | None = None):
        self.generation_id = generation_id
        if message is None:
            message = f"Generation {generation_id} was cancelled"
        super().__init__(message)
