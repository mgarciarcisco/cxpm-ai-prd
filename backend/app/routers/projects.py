"""Project CRUD API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import MeetingRecap, Project, Requirement
from app.schemas import (
    MeetingListItemResponse,
    ProjectCreate,
    ProjectResponse,
    ProjectStatsResponse,
    ProjectUpdate,
    SectionCount,
)

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(project: ProjectCreate, db: Session = Depends(get_db)) -> Project:
    """Create a new project."""
    db_project = Project(
        name=project.name,
        description=project.description,
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project


@router.get("", response_model=list[ProjectResponse])
def list_projects(db: Session = Depends(get_db)) -> list[Project]:
    """Get list of all projects."""
    return db.query(Project).all()


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(project_id: str, db: Session = Depends(get_db)) -> Project:
    """Get a single project by ID."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: str,
    project_update: ProjectUpdate,
    db: Session = Depends(get_db),
) -> Project:
    """Update an existing project."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    # Update only provided fields
    update_data = project_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)

    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: str, db: Session = Depends(get_db)) -> None:
    """Delete a project."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    db.delete(project)
    db.commit()


@router.get("/{project_id}/meetings", response_model=list[MeetingListItemResponse])
def list_project_meetings(project_id: str, db: Session = Depends(get_db)) -> list[MeetingRecap]:
    """Get list of meetings for a project."""
    # Verify project exists
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    return db.query(MeetingRecap).filter(MeetingRecap.project_id == project_id).all()


@router.get("/{project_id}/stats", response_model=ProjectStatsResponse)
def get_project_stats(project_id: str, db: Session = Depends(get_db)) -> ProjectStatsResponse:
    """Get project statistics including meeting count, requirement counts, and last activity."""
    # Verify project exists
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    # Count meetings
    meeting_count = db.query(func.count(MeetingRecap.id)).filter(
        MeetingRecap.project_id == project_id
    ).scalar() or 0

    # Count total active requirements
    total_requirement_count = db.query(func.count(Requirement.id)).filter(
        Requirement.project_id == project_id,
        Requirement.is_active == True
    ).scalar() or 0

    # Count requirements by section
    section_counts = db.query(
        Requirement.section,
        func.count(Requirement.id)
    ).filter(
        Requirement.project_id == project_id,
        Requirement.is_active == True
    ).group_by(Requirement.section).all()

    requirement_counts_by_section = [
        SectionCount(section=section.value, count=count)
        for section, count in section_counts
    ]

    # Find last activity - most recent applied_at from meetings, or created_at if none applied
    last_applied = db.query(func.max(MeetingRecap.applied_at)).filter(
        MeetingRecap.project_id == project_id,
        MeetingRecap.applied_at.isnot(None)
    ).scalar()

    if last_applied:
        last_activity = last_applied
    else:
        # Fall back to most recent meeting created_at or project created_at
        last_meeting_created = db.query(func.max(MeetingRecap.created_at)).filter(
            MeetingRecap.project_id == project_id
        ).scalar()
        last_activity = last_meeting_created or project.created_at

    return ProjectStatsResponse(
        meeting_count=meeting_count,
        requirement_count=total_requirement_count,
        requirement_counts_by_section=requirement_counts_by_section,
        last_activity=last_activity
    )
