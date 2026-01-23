"""Requirements API endpoints."""

import re
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Project, Requirement, Section, RequirementHistory, Actor, Action
from app.schemas import RequirementsListResponse, RequirementResponse, RequirementSourceResponse, RequirementUpdate, RequirementReorderRequest, RequirementHistoryResponse
from app.services import export_markdown

router = APIRouter(prefix="/api", tags=["requirements"])


def _build_requirement_response(requirement: Requirement) -> RequirementResponse:
    """Build a RequirementResponse from a Requirement model instance."""
    return RequirementResponse(
        id=str(requirement.id),
        section=requirement.section,
        content=requirement.content,
        order=requirement.order,
        sources=[
            RequirementSourceResponse(
                id=str(source.id),
                meeting_id=str(source.meeting_id) if source.meeting_id else None,
                meeting_title=source.meeting.title if source.meeting else None,
                meeting_item_id=str(source.meeting_item_id) if source.meeting_item_id else None,
                source_quote=source.source_quote,
                created_at=source.created_at,
            )
            for source in requirement.sources
        ],
        history_count=len(requirement.history),
    )


@router.get("/projects/{project_id}/requirements", response_model=RequirementsListResponse)
def list_project_requirements(
    project_id: str, db: Session = Depends(get_db)
) -> RequirementsListResponse:
    """Get all active requirements for a project, grouped by section.

    Returns requirements grouped by the 9 sections in proper section order.
    Only active requirements (is_active=True) are included.
    Each requirement includes source meeting links.
    """
    # Verify project exists
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    # Query all active requirements for this project, ordered by section then order
    requirements = (
        db.query(Requirement)
        .filter(Requirement.project_id == project_id, Requirement.is_active == True)
        .order_by(Requirement.section, Requirement.order)
        .all()
    )

    # Group requirements by section
    grouped: dict[str, list[RequirementResponse]] = {
        "problems": [],
        "user_goals": [],
        "functional_requirements": [],
        "data_needs": [],
        "constraints": [],
        "non_goals": [],
        "risks_assumptions": [],
        "open_questions": [],
        "action_items": [],
    }

    for req in requirements:
        response = _build_requirement_response(req)
        grouped[req.section.value].append(response)

    return RequirementsListResponse(**grouped)


def _slugify_filename(name: str) -> str:
    """Convert a project name to a safe filename slug."""
    # Convert to lowercase
    slug = name.lower()
    # Replace spaces with hyphens
    slug = slug.replace(" ", "-")
    # Remove any characters that aren't alphanumeric, hyphens, or underscores
    slug = re.sub(r"[^a-z0-9\-_]", "", slug)
    # Remove consecutive hyphens
    slug = re.sub(r"-+", "-", slug)
    # Trim hyphens from start and end
    slug = slug.strip("-")
    # Fallback if empty
    return slug or "requirements"


@router.get("/projects/{project_id}/requirements/export")
def export_project_requirements(
    project_id: str, db: Session = Depends(get_db)
) -> Response:
    """Export all active requirements for a project as a Markdown document.

    Returns a Markdown-formatted text file with Content-Type: text/markdown.
    The Content-Disposition header suggests a filename based on the project name.
    """
    # Verify project exists and get name for filename
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    try:
        markdown_content = export_markdown(UUID(project_id), db)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    # Generate safe filename from project name
    filename_slug = _slugify_filename(project.name)  # type: ignore[arg-type]
    filename = f"{filename_slug}-requirements.md"

    return Response(
        content=markdown_content,
        media_type="text/markdown",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@router.put(
    "/requirements/{requirement_id}",
    response_model=RequirementResponse,
)
def update_requirement(
    requirement_id: str,
    update_data: RequirementUpdate,
    db: Session = Depends(get_db),
) -> RequirementResponse:
    """Update a requirement's content.

    Records the change in RequirementHistory with actor=user, action=modified.
    Returns the updated requirement.
    """
    # Find the requirement
    requirement = db.query(Requirement).filter(Requirement.id == requirement_id).first()
    if not requirement:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requirement not found")

    # Store old content for history
    old_content = requirement.content

    # Update the requirement
    requirement.content = update_data.content  # type: ignore[assignment]

    # Record change in history
    history_entry = RequirementHistory(
        requirement_id=requirement.id,
        actor=Actor.user,
        action=Action.modified,
        old_content=old_content,
        new_content=update_data.content,
    )
    db.add(history_entry)

    db.commit()
    db.refresh(requirement)

    return _build_requirement_response(requirement)


@router.delete(
    "/requirements/{requirement_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_requirement(
    requirement_id: str,
    db: Session = Depends(get_db),
) -> None:
    """Soft-delete a requirement by setting is_active=False.

    Records the change in RequirementHistory with actor=user, action=deactivated.
    Returns 204 No Content on success.
    """
    # Find the requirement
    requirement = db.query(Requirement).filter(Requirement.id == requirement_id).first()
    if not requirement:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requirement not found")

    # Soft-delete by setting is_active to False
    requirement.is_active = False  # type: ignore[assignment]

    # Record change in history
    history_entry = RequirementHistory(
        requirement_id=requirement.id,
        actor=Actor.user,
        action=Action.deactivated,
        old_content=requirement.content,
        new_content=None,
    )
    db.add(history_entry)

    db.commit()
    return None


@router.put(
    "/projects/{project_id}/requirements/reorder",
    status_code=status.HTTP_200_OK,
)
def reorder_requirements(
    project_id: str,
    reorder_data: RequirementReorderRequest,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """Reorder requirements within a section.

    Updates the order field for each requirement based on the provided requirement_ids array.
    Returns 200 OK with success message.
    """
    # Verify project exists
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    # Get all active requirements for this section and project
    requirements = (
        db.query(Requirement)
        .filter(
            Requirement.project_id == project_id,
            Requirement.section == reorder_data.section,
            Requirement.is_active == True,
        )
        .all()
    )

    # Create a lookup dict by ID
    requirements_by_id = {str(req.id): req for req in requirements}

    # Update order based on position in requirement_ids
    for new_order, req_id in enumerate(reorder_data.requirement_ids, start=1):
        if req_id in requirements_by_id:
            requirements_by_id[req_id].order = new_order  # type: ignore[assignment]

    db.commit()

    return {"success": "true"}


@router.get(
    "/requirements/{requirement_id}/history",
    response_model=list[RequirementHistoryResponse],
)
def get_requirement_history(
    requirement_id: str,
    db: Session = Depends(get_db),
) -> list[RequirementHistoryResponse]:
    """Get the change history for a requirement.

    Returns history entries ordered by created_at descending (newest first).
    Includes actor, action, old_content, and new_content for each entry.
    """
    # Find the requirement
    requirement = db.query(Requirement).filter(Requirement.id == requirement_id).first()
    if not requirement:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requirement not found")

    # Query history entries ordered by created_at descending
    history_entries = (
        db.query(RequirementHistory)
        .filter(RequirementHistory.requirement_id == requirement_id)
        .order_by(RequirementHistory.created_at.desc())
        .all()
    )

    return [
        RequirementHistoryResponse(
            id=str(entry.id),
            actor=entry.actor,
            action=entry.action,
            old_content=entry.old_content,
            new_content=entry.new_content,
            created_at=entry.created_at,  # type: ignore[arg-type]
        )
        for entry in history_entries
    ]
