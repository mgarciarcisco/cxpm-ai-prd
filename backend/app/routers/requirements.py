"""Requirements API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Project, Requirement, Section
from app.schemas import RequirementsListResponse, RequirementResponse, RequirementSourceResponse

router = APIRouter(prefix="/api/projects", tags=["requirements"])


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
                meeting_item_id=str(source.meeting_item_id) if source.meeting_item_id else None,
                source_quote=source.source_quote,
                created_at=source.created_at,
            )
            for source in requirement.sources
        ],
        history_count=len(requirement.history),
    )


@router.get("/{project_id}/requirements", response_model=RequirementsListResponse)
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
