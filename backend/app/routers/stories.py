"""Stories API endpoints for generating, managing, and exporting User Stories."""

import csv
import io
import json
import re
from collections.abc import AsyncIterator
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, status
from fastapi.responses import Response
from sqlalchemy import or_
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse

from app.database import SessionLocal, get_db
from app.exceptions import LLMResponseError, NoRequirementsError
from app.models import (
    Project,
    StoryBatch,
    StoryBatchStatus,
    StoryFormat,
    StorySize,
    StoryStatus,
    UserStory,
)
from app.schemas import (
    PaginatedResponse,
    ReorderRequest,
    StoryBatchResponse,
    StoryBatchStatusResponse,
    StoryCreateRequest,
    StoriesGenerateRequest,
    StoryExportFormat,
    StoryUpdateRequest,
    UserStoryResponse,
)
from app.services import generate_stories_task, update_export_status
from app.services.llm import LLMError
from app.services.stories_generator import StoriesGenerator

router = APIRouter(prefix="/api", tags=["stories"])


def _get_project_or_404(project_id: str, db: Session) -> Project:
    """Get a project by ID or raise 404."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


def _get_batch_or_404(batch_id: str, db: Session, verify_project_access: bool = True) -> StoryBatch:
    """Get a story batch by ID or raise 404.
    
    Args:
        batch_id: The batch's unique identifier.
        db: Database session.
        verify_project_access: If True (default), also verify the batch's project exists
            and is accessible. This ensures users can only access batches belonging to
            projects they have access to. When authentication is implemented, this
            will also verify the current user has permission to access the project.
    
    Raises:
        HTTPException: 404 if batch not found or project not accessible.
    """
    batch = db.query(StoryBatch).filter(StoryBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Story batch not found")
    
    # Verify project access - ensures the batch's project exists and is accessible
    # When authentication is implemented, this would also verify user permissions
    if verify_project_access:
        project = db.query(Project).filter(Project.id == batch.project_id).first()
        if not project:
            # Project was deleted but batch still exists - treat as inaccessible
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Story batch not found"
            )
    
    return batch


def _get_story_or_404(story_id: str, db: Session, verify_project_access: bool = True) -> UserStory:
    """Get a story by ID or raise 404. Excludes soft-deleted stories.
    
    Args:
        story_id: The story's unique identifier.
        db: Database session.
        verify_project_access: If True (default), also verify the story's project exists
            and is accessible. This ensures users can only access stories belonging to
            projects they have access to. When authentication is implemented, this
            will also verify the current user has permission to access the project.
    
    Raises:
        HTTPException: 404 if story not found or project not accessible.
    """
    story = db.query(UserStory).filter(UserStory.id == story_id, UserStory.deleted_at.is_(None)).first()
    if not story:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Story not found")
    
    # Verify project access - ensures the story's project exists and is accessible
    # When authentication is implemented, this would also verify user permissions
    if verify_project_access:
        project = db.query(Project).filter(Project.id == story.project_id).first()
        if not project:
            # Project was deleted but story still exists - treat as inaccessible
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Story not found"
            )
    
    return story


def _story_to_response(story: UserStory) -> UserStoryResponse:
    """Convert a UserStory model to UserStoryResponse schema."""
    return UserStoryResponse(
        id=str(story.id),
        project_id=str(story.project_id),
        batch_id=str(story.batch_id) if story.batch_id else None,
        story_id=story.story_id,
        story_number=story.story_number,
        format=story.format,
        title=story.title,
        description=story.description,
        acceptance_criteria=story.acceptance_criteria,
        order=story.order,
        labels=story.labels,
        size=story.size,
        requirement_ids=story.requirement_ids,
        status=story.status,
        created_by=story.created_by,
        updated_by=story.updated_by,
        created_at=story.created_at,
        updated_at=story.updated_at,
    )


def _batch_to_response(batch: StoryBatch) -> StoryBatchResponse:
    """Convert a StoryBatch model to StoryBatchResponse schema."""
    return StoryBatchResponse(
        id=str(batch.id),
        project_id=str(batch.project_id),
        format=batch.format,
        section_filter=batch.section_filter,
        story_count=batch.story_count,
        status=batch.status,
        error_message=batch.error_message,
        created_by=batch.created_by,
        created_at=batch.created_at,
    )


def _run_generate_stories_task(
    batch_id: str,
    created_by: Optional[str] = None,
) -> None:
    """Wrapper to run generate_stories_task with a fresh database session.

    Background tasks run after the request completes and the original
    session is closed, so we create a new session for the task.
    """
    db = SessionLocal()
    try:
        generate_stories_task(db, batch_id, created_by)
    finally:
        db.close()


def _slugify_filename(name: str) -> str:
    """Convert a project name to a safe filename slug."""
    slug = name.lower()
    slug = slug.replace(" ", "-")
    slug = re.sub(r"[^a-z0-9\-_]", "", slug)
    slug = re.sub(r"-+", "-", slug)
    slug = slug.strip("-")
    return slug or "stories"


# =============================================================================
# Story Generation Endpoints
# =============================================================================


@router.post(
    "/projects/{project_id}/stories/generate",
    response_model=StoryBatchStatusResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def generate_stories(
    project_id: str,
    request: StoriesGenerateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> StoryBatchStatusResponse:
    """Start user stories generation for a project.

    Creates a StoryBatch record with status=queued and starts generation in the background.
    Use GET /stories/batches/{batch_id}/status to poll for completion.

    Note: Each generation creates NEW stories. Stories are appended, not replaced.
    """
    # Verify project exists
    _get_project_or_404(project_id, db)

    # Create batch record with queued status
    batch = StoryBatch(
        project_id=project_id,
        format=request.format,
        section_filter=request.section_filter,
        status=StoryBatchStatus.QUEUED,
        created_by=None,  # Would be set from auth context
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)

    # Schedule background generation task
    background_tasks.add_task(
        _run_generate_stories_task,
        batch_id=str(batch.id),
        created_by=None,  # Would be set from auth context
    )

    return StoryBatchStatusResponse(
        id=str(batch.id),
        status=batch.status,
        story_count=0,
        error_message=None,
    )


@router.get("/projects/{project_id}/stories/stream")
async def stream_stories_generation(
    project_id: str,
    request: Request,
    format: StoryFormat = Query(default=StoryFormat.CLASSIC, description="Story format (classic or job_story)"),
    section_filter: Optional[list[str]] = Query(default=None, description="Optional sections to filter requirements"),
    db: Session = Depends(get_db),
) -> EventSourceResponse:
    """Stream user story generation as Server-Sent Events (SSE).

    This endpoint streams the story generation story by story as they are
    generated by the LLM. The batch and stories are saved to the database
    after all stories are complete.

    Emits events:
    - {event: 'status', data: {status: 'generating', format: '...'}} at start
    - {event: 'story', data: {title, description, acceptance_criteria, ...}} for each story
    - {event: 'complete', data: {batch_id, story_count}} when done
    - {event: 'error', data: {message: '...'}} on failure

    Args:
        project_id: The project to generate stories for.
        request: FastAPI request object for disconnect detection.
        format: Story format - 'classic' or 'job_story'.
        section_filter: Optional sections to include.
        db: Database session.

    Returns:
        EventSourceResponse streaming the generation events.
    """
    # Verify project exists
    project = _get_project_or_404(project_id, db)

    async def event_generator() -> AsyncIterator[dict[str, Any]]:
        """Generate SSE events for story streaming."""
        try:
            # Emit initial status event
            yield {
                "event": "status",
                "data": json.dumps({
                    "status": "generating",
                    "format": format.value,
                    "project_name": project.name,
                }),
            }

            # Create generator and stream stories
            generator = StoriesGenerator(db)
            async for event in generator.generate_stream(
                project_id=project_id,
                format=format,
                section_filter=section_filter,
                created_by=None,  # Would be set from auth context
            ):
                # Check if client disconnected
                if await request.is_disconnected():
                    break

                event_type = event.get("type", "unknown")

                if event_type == "story":
                    yield {
                        "event": "story",
                        "data": json.dumps({
                            "title": event["title"],
                            "description": event["description"],
                            "acceptance_criteria": event.get("acceptance_criteria", []),
                            "suggested_size": event.get("suggested_size"),
                            "suggested_labels": event.get("suggested_labels", []),
                            "source_requirement_ids": event.get("source_requirement_ids", []),
                        }),
                    }
                elif event_type == "complete":
                    yield {
                        "event": "complete",
                        "data": json.dumps({
                            "batch_id": event["batch_id"],
                            "story_count": event["story_count"],
                        }),
                    }

        except NoRequirementsError as e:
            yield {
                "event": "error",
                "data": json.dumps({"message": str(e)}),
            }

        except LLMResponseError as e:
            yield {
                "event": "error",
                "data": json.dumps({"message": f"Failed to parse LLM response: {e}"}),
            }

        except LLMError as e:
            yield {
                "event": "error",
                "data": json.dumps({"message": f"LLM error: {e}"}),
            }

        except Exception as e:
            yield {
                "event": "error",
                "data": json.dumps({"message": f"Generation failed: {e}"}),
            }

    return EventSourceResponse(event_generator())


@router.get("/stories/batches/{batch_id}/status", response_model=StoryBatchStatusResponse)
def get_batch_status(batch_id: str, db: Session = Depends(get_db)) -> StoryBatchStatusResponse:
    """Get the current generation status of a story batch.

    Use this endpoint to poll for generation completion.
    Returns status=ready when generation is complete.
    """
    batch = _get_batch_or_404(batch_id, db)

    return StoryBatchStatusResponse(
        id=str(batch.id),
        status=batch.status,
        story_count=batch.story_count,
        error_message=batch.error_message,
    )


@router.post("/stories/batches/{batch_id}/cancel", response_model=StoryBatchStatusResponse)
def cancel_batch_generation(batch_id: str, db: Session = Depends(get_db)) -> StoryBatchStatusResponse:
    """Cancel story batch generation if still in progress.

    Only works if status is queued or generating.
    Returns the updated status.
    """
    batch = _get_batch_or_404(batch_id, db)

    if batch.status not in (StoryBatchStatus.QUEUED, StoryBatchStatus.GENERATING):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel batch with status '{batch.status.value}'. Only queued or generating batches can be cancelled.",
        )

    batch.status = StoryBatchStatus.CANCELLED
    db.commit()
    db.refresh(batch)

    return StoryBatchStatusResponse(
        id=str(batch.id),
        status=batch.status,
        story_count=batch.story_count,
        error_message=None,
    )


# =============================================================================
# Story Batch List Endpoint
# =============================================================================


@router.get(
    "/projects/{project_id}/stories/batches",
    response_model=list[StoryBatchResponse],
)
def list_project_batches(
    project_id: str,
    db: Session = Depends(get_db),
) -> list[StoryBatchResponse]:
    """List all story generation batches for a project.

    Batches are sorted by creation date descending (newest first).
    """
    # Verify project exists
    _get_project_or_404(project_id, db)

    batches = (
        db.query(StoryBatch)
        .filter(StoryBatch.project_id == project_id)
        .order_by(StoryBatch.created_at.desc())
        .all()
    )

    return [_batch_to_response(batch) for batch in batches]


# =============================================================================
# Story CRUD Endpoints
# =============================================================================


@router.get(
    "/projects/{project_id}/stories",
    response_model=PaginatedResponse[UserStoryResponse],
)
def list_project_stories(
    project_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    batch_id: Optional[str] = Query(None),
    status_filter: Optional[StoryStatus] = Query(None, alias="status"),
    labels: Optional[str] = Query(None, description="Comma-separated list of labels to filter by"),
    db: Session = Depends(get_db),
) -> PaginatedResponse[UserStoryResponse]:
    """List all user stories for a project with pagination.

    Stories are sorted by order, then by story_number.
    Supports filtering by batch_id, status, and labels.
    """
    # Verify project exists
    _get_project_or_404(project_id, db)

    # Build query
    query = db.query(UserStory).filter(
        UserStory.project_id == project_id,
        UserStory.deleted_at.is_(None),
    )

    # Apply filters
    if batch_id:
        query = query.filter(UserStory.batch_id == batch_id)

    if status_filter:
        query = query.filter(UserStory.status == status_filter)

    if labels:
        # Filter by labels - story must have ALL of the requested labels
        # Using LIKE pattern matching on JSON string with exact array element matching
        # This prevents partial matches (e.g., 'frontend' matching 'not-frontend')
        label_list = [label.strip() for label in labels.split(",")]
        for label in label_list:
            # To match exact array elements, we need to check for the label
            # in all possible positions within the JSON array:
            # 1. '["label"]' - single element array
            # 2. '["label",' - first element in multi-element array (with/without space)
            # 3. ',"label",' - middle element in array (with/without spaces)
            # 4. ',"label"]' - last element in multi-element array (with/without space)
            #
            # JSON serialization may include spaces after commas (e.g., '["a", "b"]')
            # so we need patterns for both with and without spaces
            query = query.filter(
                or_(
                    UserStory.labels.like(f'["{label}"]'),        # Single element
                    UserStory.labels.like(f'["{label}",%'),       # First element, no space
                    UserStory.labels.like(f'["{label}", %'),      # First element, with space
                    UserStory.labels.like(f'%, "{label}", %'),    # Middle element, with spaces
                    UserStory.labels.like(f'%,"{label}",%'),      # Middle element, no spaces
                    UserStory.labels.like(f'%, "{label}"]'),      # Last element, with space
                    UserStory.labels.like(f'%,"{label}"]'),       # Last element, no space
                )
            )

    # Get total count
    total = query.count()

    # Get paginated results
    stories = query.order_by(UserStory.order, UserStory.story_number).offset(skip).limit(limit).all()

    return PaginatedResponse(
        items=[_story_to_response(story) for story in stories],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/stories/{story_id}", response_model=UserStoryResponse)
def get_story(story_id: str, db: Session = Depends(get_db)) -> UserStoryResponse:
    """Get a single user story with all details."""
    story = _get_story_or_404(story_id, db)
    return _story_to_response(story)


@router.post("/projects/{project_id}/stories", response_model=UserStoryResponse, status_code=status.HTTP_201_CREATED)
def create_story(
    project_id: str,
    request: StoryCreateRequest,
    db: Session = Depends(get_db),
) -> UserStoryResponse:
    """Create a new user story manually.

    Auto-generates the next story number (story_id like 'US-001').
    The story is added to the end of the list (highest order value).
    """
    # Verify project exists
    project = _get_project_or_404(project_id, db)

    # Get the next story number for this project
    max_story_number = db.query(UserStory.story_number).filter(
        UserStory.project_id == project_id,
    ).order_by(UserStory.story_number.desc()).first()

    next_story_number = (max_story_number[0] + 1) if max_story_number else 1

    # Get the next order value
    max_order = db.query(UserStory.order).filter(
        UserStory.project_id == project_id,
        UserStory.deleted_at.is_(None),
    ).order_by(UserStory.order.desc()).first()

    next_order = (max_order[0] + 1) if max_order else 0

    # Create the story
    story = UserStory(
        project_id=project_id,
        batch_id=None,  # Manually created, no batch
        story_number=next_story_number,
        format=StoryFormat.CLASSIC,  # Default format for manual stories
        title=request.title,
        description=request.description,
        acceptance_criteria=request.acceptance_criteria or [],
        labels=request.labels or [],
        size=request.size,
        status=request.status or StoryStatus.DRAFT,
        order=next_order,
        created_by=None,  # Would be set from auth context
    )

    db.add(story)

    # Update project stories_status if this is the first story
    if project.stories_status == "empty":
        project.stories_status = "generated"

    db.commit()
    db.refresh(story)

    return _story_to_response(story)


@router.put("/stories/{story_id}", response_model=UserStoryResponse)
def update_story(
    story_id: str,
    update_data: StoryUpdateRequest,
    db: Session = Depends(get_db),
) -> UserStoryResponse:
    """Update a user story's details.

    Only the provided fields will be updated.
    Returns the updated story.
    """
    story = _get_story_or_404(story_id, db)

    # Update fields if provided
    if update_data.title is not None:
        story.title = update_data.title

    if update_data.description is not None:
        story.description = update_data.description

    if update_data.acceptance_criteria is not None:
        story.acceptance_criteria = update_data.acceptance_criteria

    if update_data.labels is not None:
        story.labels = update_data.labels

    if update_data.size is not None:
        story.size = update_data.size

    if update_data.status is not None:
        story.status = update_data.status

    story.updated_at = datetime.utcnow()
    story.updated_by = None  # Would be set from auth context
    db.commit()
    db.refresh(story)

    return _story_to_response(story)


@router.delete("/stories/{story_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_story(story_id: str, db: Session = Depends(get_db)) -> None:
    """Soft delete a user story by setting deleted_at timestamp.

    The story will no longer appear in list results.
    """
    story = _get_story_or_404(story_id, db)

    story.deleted_at = datetime.utcnow()
    db.commit()

    return None


# =============================================================================
# Story Reorder Endpoint
# =============================================================================


@router.post("/projects/{project_id}/stories/reorder", status_code=status.HTTP_200_OK)
def reorder_stories(
    project_id: str,
    request: ReorderRequest,
    db: Session = Depends(get_db),
) -> dict:
    """Reorder stories by providing the new order of story IDs.

    The order field will be updated for each story based on its position
    in the story_ids array.
    """
    # Verify project exists
    _get_project_or_404(project_id, db)

    # Verify all stories exist and belong to this project
    for i, story_id in enumerate(request.story_ids):
        story = db.query(UserStory).filter(
            UserStory.id == story_id,
            UserStory.project_id == project_id,
            UserStory.deleted_at.is_(None),
        ).first()

        if not story:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Story {story_id} not found or doesn't belong to this project",
            )

        story.order = i
        story.updated_at = datetime.utcnow()

    db.commit()

    return {"message": "Stories reordered successfully", "count": len(request.story_ids)}


# =============================================================================
# Batch Delete Endpoint
# =============================================================================


@router.delete(
    "/projects/{project_id}/stories/batch/{batch_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_batch_stories(
    project_id: str,
    batch_id: str,
    db: Session = Depends(get_db),
) -> None:
    """Delete all stories in a batch.

    This soft deletes all stories that belong to the specified batch.
    The batch record itself is also deleted.
    """
    # Verify project exists
    _get_project_or_404(project_id, db)

    # Verify batch exists and belongs to project
    batch = db.query(StoryBatch).filter(
        StoryBatch.id == batch_id,
        StoryBatch.project_id == project_id,
    ).first()

    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Batch not found or doesn't belong to this project",
        )

    # Soft delete all stories in the batch
    now = datetime.utcnow()
    stories = db.query(UserStory).filter(
        UserStory.batch_id == batch_id,
        UserStory.deleted_at.is_(None),
    ).all()

    for story in stories:
        story.deleted_at = now

    # Delete the batch record
    db.delete(batch)
    db.commit()

    return None


# =============================================================================
# Export Endpoint
# =============================================================================


@router.get("/projects/{project_id}/stories/export")
def export_stories(
    project_id: str,
    format: StoryExportFormat = Query(StoryExportFormat.MARKDOWN),
    batch_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
) -> Response:
    """Export stories in the specified format.

    Supported formats:
    - markdown: Returns stories as a Markdown document
    - csv: Returns stories as CSV with pipe-separated acceptance criteria
    - json: Returns stories as a JSON array

    Optionally filter by batch_id to export only stories from a specific batch.
    Returns a downloadable file with appropriate content-type.
    """
    # Verify project exists
    project = _get_project_or_404(project_id, db)

    # Build query for stories
    query = db.query(UserStory).filter(
        UserStory.project_id == project_id,
        UserStory.deleted_at.is_(None),
    )

    if batch_id:
        query = query.filter(UserStory.batch_id == batch_id)

    stories = query.order_by(UserStory.order, UserStory.story_number).all()

    if not stories:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No stories found to export",
        )

    # Get project name for filename
    project_name = project.name if project else "project"
    filename_base = _slugify_filename(project_name)

    if format == StoryExportFormat.MARKDOWN:
        content = _export_markdown(stories)
        filename = f"{filename_base}-stories.md"
        media_type = "text/markdown"

    elif format == StoryExportFormat.CSV:
        content = _export_csv(stories)
        filename = f"{filename_base}-stories.csv"
        media_type = "text/csv"

    else:  # JSON
        content = _export_json(stories)
        filename = f"{filename_base}-stories.json"
        media_type = "application/json"

    # Auto-update project's export_status on first export
    update_export_status(project_id, db)

    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


def _export_markdown(stories: list[UserStory]) -> str:
    """Export stories as Markdown."""
    lines = ["# User Stories", ""]

    for story in stories:
        lines.append(f"## {story.story_id}: {story.title}")
        lines.append("")

        if story.description:
            lines.append(story.description)
            lines.append("")

        if story.acceptance_criteria:
            lines.append("### Acceptance Criteria")
            lines.append("")
            for criterion in story.acceptance_criteria:
                lines.append(f"- [ ] {criterion}")
            lines.append("")

        # Metadata
        metadata = []
        if story.size:
            metadata.append(f"**Size:** {story.size.value.upper()}")
        if story.labels:
            metadata.append(f"**Labels:** {', '.join(story.labels)}")
        if story.status:
            metadata.append(f"**Status:** {story.status.value}")

        if metadata:
            lines.append(" | ".join(metadata))
            lines.append("")

        lines.append("---")
        lines.append("")

    return "\n".join(lines)


def _export_csv(stories: list[UserStory]) -> str:
    """Export stories as CSV with pipe-separated acceptance criteria."""
    output = io.StringIO()
    writer = csv.writer(output)

    # Header row
    writer.writerow([
        "Story ID",
        "Title",
        "Description",
        "Acceptance Criteria",
        "Size",
        "Labels",
        "Status",
        "Format",
    ])

    for story in stories:
        # Format acceptance criteria as pipe-separated
        ac_text = " | ".join(story.acceptance_criteria) if story.acceptance_criteria else ""
        labels_text = ", ".join(story.labels) if story.labels else ""

        writer.writerow([
            story.story_id,
            story.title,
            story.description or "",
            ac_text,
            story.size.value.upper() if story.size else "",
            labels_text,
            story.status.value if story.status else "",
            story.format.value if story.format else "",
        ])

    return output.getvalue()


def _export_json(stories: list[UserStory]) -> str:
    """Export stories as JSON."""
    stories_data = []

    for story in stories:
        stories_data.append({
            "story_id": story.story_id,
            "story_number": story.story_number,
            "title": story.title,
            "description": story.description,
            "acceptance_criteria": story.acceptance_criteria or [],
            "size": story.size.value if story.size else None,
            "labels": story.labels or [],
            "status": story.status.value if story.status else None,
            "format": story.format.value if story.format else None,
            "requirement_ids": story.requirement_ids or [],
            "created_at": story.created_at.isoformat() if story.created_at else None,
            "updated_at": story.updated_at.isoformat() if story.updated_at else None,
        })

    return json.dumps({"stories": stories_data}, indent=2)
