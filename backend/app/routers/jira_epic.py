"""JIRA Epic API endpoints for generating epics from requirements."""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.services.jira_epic_generator import JiraEpicGenerator, JiraEpicGeneratorError

router = APIRouter(prefix="/api/jira-epic", tags=["jira-epic"])


class JiraEpicGenerateRequest(BaseModel):
    """Request model for JIRA Epic generation."""

    requirements: str = Field(
        ...,
        description="Requirements document (up to 1GB)",
        min_length=1,
    )


class JiraEpicGenerateResponse(BaseModel):
    """Response model for JIRA Epic generation."""

    epic: str = Field(..., description="Generated JIRA Epic content")


@router.post("/generate", response_model=JiraEpicGenerateResponse, status_code=status.HTTP_200_OK)
async def generate_jira_epic(request: JiraEpicGenerateRequest) -> JiraEpicGenerateResponse:
    """
    Generate a JIRA Epic from requirements.

    This endpoint takes a requirements document (up to 1GB) and uses the
    Ollama LLM service to generate a structured JIRA Epic following best practices.

    Args:
        request: The generation request containing the requirements document.

    Returns:
        JiraEpicGenerateResponse: The generated JIRA Epic with structured sections.

    Raises:
        HTTPException 400: If requirements are invalid or too large.
        HTTPException 500: If epic generation fails.
        HTTPException 503: If LLM service is unavailable.
    """
    try:
        # Initialize the generator
        generator = JiraEpicGenerator()

        # Generate the JIRA Epic
        epic = generator.create_jira_epic(request.requirements)

        return JiraEpicGenerateResponse(epic=epic)

    except ValueError as e:
        # Invalid input (empty, too large, etc.)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except JiraEpicGeneratorError as e:
        # Check if it's an LLM availability error
        error_msg = str(e)
        if "not available" in error_msg.lower() or "failed to get llm provider" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"LLM service unavailable: {error_msg}",
            )
        # Other generation errors
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate JIRA Epic: {error_msg}",
        )
    except Exception as e:
        # Unexpected errors
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error: {str(e)}",
        )
