"""PRD API endpoints for generating, managing, and exporting Product Requirements Documents."""

import json
import logging
import re
from collections.abc import AsyncIterator
from datetime import datetime
from typing import Any

logger = logging.getLogger(__name__)

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, status
from fastapi.responses import Response
from sqlalchemy import func
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse

from app.activity import log_activity_safe
from app.auth import get_current_user, get_current_user_from_query
from app.database import SessionLocal, get_db
from app.exceptions import LLMResponseError, NoRequirementsError
from app.models import PRD, PRDMode, PRDStatus, Project
from app.models.user import User
from app.schemas import (
    ExportFormat,
    PaginatedResponse,
    PRDCreateRequest,
    PRDGenerateRequest,
    PRDResponse,
    PRDSection,
    PRDStatusResponse,
    PRDSummary,
    PRDUpdateRequest,
)
from app.services import generate_prd_task, update_export_status
from app.services.llm import LLMError
from app.services.prd_generator import PRDGenerator

router = APIRouter(prefix="/api", tags=["prds"])


def _get_project_or_404(project_id: str, db: Session, current_user: User) -> Project:
    """Get a project by ID or raise 404."""
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


def _get_prd_or_404(prd_id: str, db: Session, current_user: User | None = None) -> PRD:
    """Get a PRD by ID or raise 404. Excludes soft-deleted PRDs.

    Args:
        prd_id: The PRD's unique identifier.
        db: Database session.
        current_user: If provided, verify the PRD's project belongs to this user.

    Raises:
        HTTPException: 404 if PRD not found or project not accessible.
    """
    prd = db.query(PRD).filter(PRD.id == prd_id, PRD.deleted_at.is_(None)).first()
    if not prd:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PRD not found")

    if current_user:
        project = db.query(Project).filter(Project.id == prd.project_id, Project.user_id == current_user.id).first()
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="PRD not found"
            )

    return prd


def _prd_to_response(prd: PRD) -> PRDResponse:
    """Convert a PRD model to PRDResponse schema."""
    sections = None
    if prd.sections:
        sections = [
            PRDSection(title=s.get("title", ""), content=s.get("content", ""))
            for s in prd.sections
        ]

    return PRDResponse(
        id=str(prd.id),
        project_id=str(prd.project_id),
        version=prd.version,
        title=prd.title,
        mode=prd.mode,
        sections=sections,
        raw_markdown=prd.raw_markdown,
        status=prd.status,
        error_message=prd.error_message,
        created_by=prd.created_by,
        updated_by=prd.updated_by,
        created_at=prd.created_at,
        updated_at=prd.updated_at,
    )


def _prd_to_summary(prd: PRD) -> PRDSummary:
    """Convert a PRD model to PRDSummary schema."""
    return PRDSummary(
        id=str(prd.id),
        project_id=str(prd.project_id),
        version=prd.version,
        title=prd.title,
        mode=prd.mode,
        status=prd.status,
        created_by=prd.created_by,
        created_at=prd.created_at,
        updated_at=prd.updated_at,
    )


def _run_generate_prd_task(
    prd_id: str,
    project_id: str,
    mode: PRDMode,
    created_by: str | None = None,
) -> None:
    """Wrapper to run generate_prd_task with a fresh database session.
    
    Background tasks run after the request completes and the original
    session is closed, so we create a new session for the task.
    """
    db = SessionLocal()
    try:
        generate_prd_task(db, prd_id, project_id, mode, created_by)
    finally:
        db.close()


def _slugify_filename(name: str) -> str:
    """Convert a project name to a safe filename slug."""
    slug = name.lower()
    slug = slug.replace(" ", "-")
    slug = re.sub(r"[^a-z0-9\-_]", "", slug)
    slug = re.sub(r"-+", "-", slug)
    slug = slug.strip("-")
    return slug or "prd"


@router.post(
    "/projects/{project_id}/prds/generate",
    response_model=PRDStatusResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def generate_prd(
    project_id: str,
    request: PRDGenerateRequest,
    http_request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PRDStatusResponse:
    """Start PRD generation for a project.

    Creates a PRD record with status=queued and starts generation in the background.
    Use GET /prds/{prd_id}/status to poll for completion.
    """
    # Verify project exists
    _get_project_or_404(project_id, db, current_user)

    # Calculate next version number for this project
    max_version = db.query(func.max(PRD.version)).filter(
        PRD.project_id == project_id,
        PRD.deleted_at.is_(None),
    ).scalar()
    next_version = (max_version or 0) + 1

    # Create PRD record with queued status
    prd = PRD(
        project_id=project_id,
        version=next_version,
        mode=request.mode,
        status=PRDStatus.QUEUED,
        created_by=current_user.name,
        updated_by=current_user.name,
    )
    db.add(prd)
    db.commit()
    db.refresh(prd)

    log_activity_safe(db, current_user.id, "prd.generation_started", "prd", str(prd.id), {"project_id": str(project_id)}, http_request)

    # Schedule background generation task
    background_tasks.add_task(
        _run_generate_prd_task,
        prd_id=str(prd.id),
        project_id=project_id,
        mode=request.mode,
        created_by=current_user.name,
    )

    return PRDStatusResponse(
        id=str(prd.id),
        status=prd.status,
        error_message=None,
        version=None,
    )


@router.post(
    "/projects/{project_id}/prds",
    response_model=PRDResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_prd(
    project_id: str,
    request: PRDCreateRequest,
    http_request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PRDResponse:
    """Create a blank PRD for manual writing.

    Creates a PRD record with ready status, allowing immediate editing.
    The project's prd_status is set to 'draft' until the user marks it as ready.

    Args:
        project_id: The project UUID.
        request: Optional title and initial sections.
        db: Database session.

    Returns:
        The newly created PRD.
    """
    from app.models import PRDStageStatus

    # Verify project exists
    project = _get_project_or_404(project_id, db, current_user)

    # Calculate next version number for this project
    max_version = db.query(func.max(PRD.version)).filter(
        PRD.project_id == project_id,
        PRD.deleted_at.is_(None),
    ).scalar()
    next_version = (max_version or 0) + 1

    # Convert sections to dict format if provided
    sections = None
    raw_markdown = None
    if request.sections:
        sections = [s.model_dump() for s in request.sections]
        raw_markdown = _generate_markdown(request.title or "", sections)

    # Create PRD record with ready status
    prd = PRD(
        project_id=project_id,
        version=next_version,
        title=request.title,
        mode=PRDMode.DRAFT,
        sections=sections,
        raw_markdown=raw_markdown,
        status=PRDStatus.READY,
        created_by=current_user.name,
        updated_by=current_user.name,
    )
    db.add(prd)

    # Update project's prd_status to draft (manual PRD starts as draft)
    project.prd_status = PRDStageStatus.draft

    db.commit()
    db.refresh(prd)
    log_activity_safe(db, current_user.id, "prd.generation_started", "prd", str(prd.id), {"project_id": str(project_id)}, http_request)

    return _prd_to_response(prd)


@router.get("/projects/{project_id}/prds/stream")
async def stream_prd_generation(
    project_id: str,
    request: Request,
    mode: PRDMode = Query(default=PRDMode.DRAFT, description="Generation mode (draft or detailed)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_query),
) -> EventSourceResponse:
    """Stream PRD generation using staged approach for faster perceived response.

    This endpoint implements section-by-section generation:
    - Stage 1: Sequential streaming of core sections (problem, goals, users, solution)
    - Stage 2: Parallel generation of independent sections
    - Stage 3: Sequential streaming of executive summary

    Emits events:
    - {event: 'status', data: {status: 'generating', mode: '...', stage: 1}} at start
    - {event: 'stage', data: {stage: N, sections: [...]}} when stage begins
    - {event: 'chunk', data: {section_id: '...', content: '...'}} during streaming
    - {event: 'section_complete', data: {section_id, title, content, order}} when section done
    - {event: 'section_failed', data: {section_id, error}} when section fails
    - {event: 'complete', data: {prd_id, version, section_count, status}} when done
    - {event: 'error', data: {message: '...'}} on critical failure

    Args:
        project_id: The project to generate PRD for.
        request: FastAPI request object for disconnect detection.
        mode: Generation mode - 'draft' or 'detailed'.
        db: Database session.

    Returns:
        EventSourceResponse streaming the generation events.
    """
    # Verify project exists
    logger.warning(f"[PRD Stream] Request received for project {project_id}, mode={mode}")
    print(f"[PRD Stream] Request received for project {project_id}, mode={mode}", flush=True)
    project = _get_project_or_404(project_id, db, current_user)
    logger.warning(f"[PRD Stream] Project found: {project.name}")

    async def event_generator() -> AsyncIterator[dict[str, Any]]:
        """Generate SSE events for staged PRD streaming."""
        try:
            logger.warning("[PRD Stream] Starting event generator, yielding status event...")
            # Emit initial status event
            yield {
                "event": "status",
                "data": json.dumps({
                    "status": "generating",
                    "mode": mode.value,
                    "project_name": project.name,
                    "staged": True,
                }),
            }
            logger.warning("[PRD Stream] Status event yielded")

            # Create generator and stream sections using staged approach
            generator = PRDGenerator(db)
            async for event in generator.generate_stream_staged(
                project_id=project_id,
                mode=mode,
                created_by=current_user.name,
            ):
                # Check if client disconnected
                if await request.is_disconnected():
                    break

                event_type = event.get("type", "unknown")

                if event_type == "stage":
                    yield {
                        "event": "stage",
                        "data": json.dumps({
                            "stage": event["stage"],
                            "sections": event["sections"],
                        }),
                    }
                elif event_type == "chunk":
                    yield {
                        "event": "chunk",
                        "data": json.dumps({
                            "section_id": event["section_id"],
                            "content": event["content"],
                        }),
                    }
                elif event_type == "section_complete":
                    yield {
                        "event": "section_complete",
                        "data": json.dumps({
                            "section_id": event["section_id"],
                            "title": event["title"],
                            "content": event["content"],
                            "order": event["order"],
                        }),
                    }
                elif event_type == "section_failed":
                    yield {
                        "event": "section_failed",
                        "data": json.dumps({
                            "section_id": event["section_id"],
                            "error": event["error"],
                        }),
                    }
                elif event_type == "complete":
                    yield {
                        "event": "complete",
                        "data": json.dumps({
                            "prd_id": event["prd_id"],
                            "version": event["version"],
                            "section_count": event["section_count"],
                            "failed_count": event.get("failed_count", 0),
                            "status": event.get("status", "ready"),
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


@router.post("/prds/{prd_id}/sections/{section_id}/regenerate")
async def regenerate_section(
    prd_id: str,
    section_id: str,
    request: Request,
    custom_instructions: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_query),
) -> EventSourceResponse:
    """Regenerate a single section of an existing PRD.

    Streams the regeneration process and returns affected downstream sections.

    Args:
        prd_id: The PRD to update.
        section_id: The section to regenerate.
        request: FastAPI request object for disconnect detection.
        custom_instructions: Optional additional instructions for regeneration.
        db: Database session.

    Returns:
        EventSourceResponse streaming the regeneration events.
    """
    # Verify PRD exists
    prd = _get_prd_or_404(prd_id, db, current_user)

    async def event_generator() -> AsyncIterator[dict[str, Any]]:
        """Generate SSE events for section regeneration."""
        try:
            # Emit initial status
            yield {
                "event": "status",
                "data": json.dumps({
                    "status": "regenerating",
                    "section_id": section_id,
                }),
            }

            generator = PRDGenerator(db)
            async for event in generator.regenerate_section(
                prd_id=prd_id,
                section_id=section_id,
                custom_instructions=custom_instructions,
                updated_by=current_user.name,
            ):
                # Check if client disconnected
                if await request.is_disconnected():
                    break

                event_type = event.get("type", "unknown")

                if event_type == "chunk":
                    yield {
                        "event": "chunk",
                        "data": json.dumps({
                            "section_id": event["section_id"],
                            "content": event["content"],
                        }),
                    }
                elif event_type == "section_complete":
                    yield {
                        "event": "section_complete",
                        "data": json.dumps({
                            "section_id": event["section_id"],
                            "title": event["title"],
                            "content": event["content"],
                            "order": event["order"],
                            "affected_sections": event.get("affected_sections", []),
                        }),
                    }

        except LLMResponseError as e:
            yield {
                "event": "error",
                "data": json.dumps({"message": f"Failed to regenerate section: {e}"}),
            }

        except LLMError as e:
            yield {
                "event": "error",
                "data": json.dumps({"message": f"LLM error: {e}"}),
            }

        except Exception as e:
            yield {
                "event": "error",
                "data": json.dumps({"message": f"Regeneration failed: {e}"}),
            }

    return EventSourceResponse(event_generator())


@router.get("/prds/{prd_id}/status", response_model=PRDStatusResponse)
def get_prd_status(prd_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> PRDStatusResponse:
    """Get the current generation status of a PRD.

    Use this endpoint to poll for generation completion.
    Returns status=ready when generation is complete.
    """
    prd = _get_prd_or_404(prd_id, db, current_user)

    return PRDStatusResponse(
        id=str(prd.id),
        status=prd.status,
        error_message=prd.error_message,
        version=prd.version if prd.status == PRDStatus.READY else None,
    )


@router.post("/prds/{prd_id}/cancel", response_model=PRDStatusResponse)
def cancel_prd_generation(prd_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> PRDStatusResponse:
    """Cancel PRD generation if still in progress.

    Only works if status is queued or generating.
    Returns the updated status.
    """
    prd = _get_prd_or_404(prd_id, db, current_user)

    if prd.status not in (PRDStatus.QUEUED, PRDStatus.GENERATING):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel PRD with status '{prd.status.value}'. Only queued or generating PRDs can be cancelled.",
        )

    prd.status = PRDStatus.CANCELLED
    prd.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(prd)

    return PRDStatusResponse(
        id=str(prd.id),
        status=prd.status,
        error_message=None,
        version=None,
    )


@router.get(
    "/projects/{project_id}/prds",
    response_model=PaginatedResponse[PRDSummary],
)
def list_project_prds(
    project_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    include_archived: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaginatedResponse[PRDSummary]:
    """List all PRDs for a project with pagination.

    By default excludes archived PRDs. Set include_archived=true to include them.
    PRDs are sorted by version descending (newest first).
    """
    # Verify project exists
    _get_project_or_404(project_id, db, current_user)

    # Build query
    query = db.query(PRD).filter(
        PRD.project_id == project_id,
        PRD.deleted_at.is_(None),
    )

    if not include_archived:
        query = query.filter(PRD.status != PRDStatus.ARCHIVED)

    # Get total count
    total = query.count()

    # Get paginated results
    prds = query.order_by(PRD.version.desc()).offset(skip).limit(limit).all()

    return PaginatedResponse(
        items=[_prd_to_summary(prd) for prd in prds],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/prds/{prd_id}", response_model=PRDResponse)
def get_prd(prd_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> PRDResponse:
    """Get a single PRD with all sections and content."""
    prd = _get_prd_or_404(prd_id, db, current_user)
    return _prd_to_response(prd)


@router.put("/prds/{prd_id}", response_model=PRDResponse)
def update_prd(
    prd_id: str,
    update_data: PRDUpdateRequest,
    http_request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PRDResponse:
    """Update a PRD's title and/or sections.

    Only title and sections can be updated.
    Returns the updated PRD.
    """
    prd = _get_prd_or_404(prd_id, db, current_user)

    # Cannot update non-ready PRDs
    if prd.status not in (PRDStatus.READY, PRDStatus.ARCHIVED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot update PRD with status '{prd.status.value}'. Only ready or archived PRDs can be updated.",
        )

    # Update title if provided
    if update_data.title is not None:
        prd.title = update_data.title

    # Update sections if provided
    if update_data.sections is not None:
        # Convert Pydantic models to dict for JSON storage
        prd.sections = [s.model_dump() for s in update_data.sections]
        # Regenerate raw_markdown from sections
        prd.raw_markdown = _generate_markdown(prd.title or "", prd.sections)

    prd.updated_at = datetime.utcnow()
    prd.updated_by = current_user.name
    db.commit()
    db.refresh(prd)
    log_activity_safe(db, current_user.id, "prd.edited", "prd", prd_id, {"section_name": update_data.title or "unknown"}, http_request)

    return _prd_to_response(prd)


def _generate_markdown(title: str, sections: list[dict]) -> str:
    """Generate markdown from PRD title and sections."""
    lines = [f"# {title}", ""]

    # Sort sections by order if present
    sorted_sections = sorted(sections, key=lambda s: s.get("order", 0))

    for section in sorted_sections:
        lines.append(f"## {section.get('title', '')}")
        lines.append("")
        lines.append(section.get("content", ""))
        lines.append("")

    return "\n".join(lines)


@router.delete("/prds/{prd_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_prd(prd_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> None:
    """Soft delete a PRD by setting deleted_at timestamp.

    The PRD will no longer appear in list results.
    """
    prd = _get_prd_or_404(prd_id, db, current_user)

    prd.deleted_at = datetime.utcnow()
    db.commit()

    return None


@router.post("/prds/{prd_id}/archive", response_model=PRDStatusResponse)
def archive_prd(prd_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> PRDStatusResponse:
    """Archive a PRD by setting status to archived.

    Archived PRDs are excluded from list by default but can be included
    with include_archived=true.
    """
    prd = _get_prd_or_404(prd_id, db, current_user)

    if prd.status != PRDStatus.READY:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot archive PRD with status '{prd.status.value}'. Only ready PRDs can be archived.",
        )

    prd.status = PRDStatus.ARCHIVED
    prd.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(prd)

    return PRDStatusResponse(
        id=str(prd.id),
        status=prd.status,
        error_message=None,
        version=prd.version,
    )


@router.post("/prds/{prd_id}/restore", response_model=PRDResponse)
def restore_prd(prd_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> PRDResponse:
    """Restore a historical PRD version by creating a new version with its content.

    Creates a new PRD with the next version number, copying the title, sections,
    and raw_markdown from the source PRD. The new PRD is immediately set to ready status.
    Also updates the project's prd_status to 'ready'.

    Args:
        prd_id: The PRD to restore from (can be any historical version).
        db: Database session.

    Returns:
        The newly created PRD with restored content.

    Raises:
        HTTPException 400: If source PRD is not in ready/archived status.
        HTTPException 404: If PRD not found.
    """
    from app.models import PRDStageStatus

    # Get the source PRD
    source_prd = _get_prd_or_404(prd_id, db, current_user)

    # Only allow restoring from ready or archived PRDs
    if source_prd.status not in (PRDStatus.READY, PRDStatus.ARCHIVED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot restore from PRD with status '{source_prd.status.value}'. Only ready or archived PRDs can be restored.",
        )

    # Calculate next version number for this project
    max_version = db.query(func.max(PRD.version)).filter(
        PRD.project_id == source_prd.project_id,
        PRD.deleted_at.is_(None),
    ).scalar()
    next_version = (max_version or 0) + 1

    # Create new PRD with content from source
    new_prd = PRD(
        project_id=source_prd.project_id,
        version=next_version,
        title=source_prd.title,
        mode=source_prd.mode,
        sections=source_prd.sections,
        raw_markdown=source_prd.raw_markdown,
        status=PRDStatus.READY,
        created_by=current_user.name,
        updated_by=current_user.name,
    )
    db.add(new_prd)

    # Update project's prd_status to ready
    project = db.query(Project).filter(Project.id == source_prd.project_id).first()
    if project:
        project.prd_status = PRDStageStatus.ready

    db.commit()
    db.refresh(new_prd)

    return _prd_to_response(new_prd)


@router.get("/prds/{prd_id}/export")
def export_prd(
    prd_id: str,
    format: ExportFormat = Query(ExportFormat.MARKDOWN),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    """Export a PRD in the specified format.
    
    Supported formats:
    - markdown: Returns the PRD as a Markdown document
    - json: Returns the PRD as a JSON object with title and sections
    
    Returns a downloadable file with appropriate content-type.
    """
    prd = _get_prd_or_404(prd_id, db, current_user)

    # Cannot export incomplete PRDs
    if prd.status not in (PRDStatus.READY, PRDStatus.ARCHIVED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot export PRD with status '{prd.status.value}'. Only ready or archived PRDs can be exported.",
        )

    # Get project for filename
    project = db.query(Project).filter(Project.id == prd.project_id).first()
    project_name = project.name if project else "project"
    filename_base = _slugify_filename(project_name)

    if format == ExportFormat.MARKDOWN:
        content = prd.raw_markdown or ""
        filename = f"{filename_base}-prd-v{prd.version}.md"
        media_type = "text/markdown"
    else:  # JSON
        export_data = {
            "title": prd.title,
            "version": prd.version,
            "mode": prd.mode.value,
            "sections": prd.sections or [],
            "created_at": prd.created_at.isoformat() if prd.created_at else None,
            "updated_at": prd.updated_at.isoformat() if prd.updated_at else None,
        }
        content = json.dumps(export_data, indent=2)
        filename = f"{filename_base}-prd-v{prd.version}.json"
        media_type = "application/json"

    # Auto-update project's export_status on first export
    update_export_status(str(prd.project_id), db)

    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )
