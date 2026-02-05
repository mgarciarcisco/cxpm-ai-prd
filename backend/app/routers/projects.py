"""Project CRUD API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import (
    ExportStatus,
    MeetingRecap,
    MockupsStatus,
    PRDStageStatus,
    Project,
    Requirement,
    RequirementsStatus,
    StoriesStatus,
)
from app.models.user import User
from app.schemas import (
    MeetingListItemResponse,
    ProgressResponse,
    ProjectCreate,
    ProjectResponse,
    ProjectStatsResponse,
    ProjectUpdate,
    SectionCount,
    StageStatusEnum,
    StageUpdateRequest,
    calculate_progress,
)

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(project: ProjectCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Project:
    """Create a new project."""
    db_project = Project(
        name=project.name,
        description=project.description,
        user_id=current_user.id,
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project


@router.get("", response_model=list[ProjectResponse])
def list_projects(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[Project]:
    """Get list of all projects."""
    return db.query(Project).filter(Project.user_id == current_user.id).all()


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(project_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Project:
    """Get a single project by ID."""
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: str,
    project_update: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Project:
    """Update an existing project."""
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
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
def delete_project(project_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> None:
    """Delete a project."""
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    db.delete(project)
    db.commit()


@router.get("/{project_id}/meetings", response_model=list[MeetingListItemResponse])
def list_project_meetings(project_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[MeetingRecap]:
    """Get list of meetings for a project."""
    # Verify project exists
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    return db.query(MeetingRecap).filter(MeetingRecap.project_id == project_id).all()


@router.get("/{project_id}/stats", response_model=ProjectStatsResponse)
def get_project_stats(project_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> ProjectStatsResponse:
    """Get project statistics including meeting count, requirement counts, and last activity."""
    # Verify project exists
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
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


@router.get("/{project_id}/progress", response_model=ProgressResponse)
def get_project_progress(project_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> ProgressResponse:
    """Get project progress with all stage statuses."""
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    return ProgressResponse(
        requirements_status=project.requirements_status.value,
        prd_status=project.prd_status.value,
        stories_status=project.stories_status.value,
        mockups_status=project.mockups_status.value,
        export_status=project.export_status.value,
        progress=calculate_progress(
            requirements_status=project.requirements_status.value,
            prd_status=project.prd_status.value,
            stories_status=project.stories_status.value,
            mockups_status=project.mockups_status.value,
            export_status=project.export_status.value,
        ),
    )


# Mapping of stage names to their model fields and valid status enums
STAGE_STATUS_MAPPING = {
    StageStatusEnum.requirements: ("requirements_status", RequirementsStatus),
    StageStatusEnum.prd: ("prd_status", PRDStageStatus),
    StageStatusEnum.stories: ("stories_status", StoriesStatus),
    StageStatusEnum.mockups: ("mockups_status", MockupsStatus),
    StageStatusEnum.export: ("export_status", ExportStatus),
}


@router.patch("/{project_id}/stages/{stage}", response_model=ProgressResponse)
def update_stage_status(
    project_id: str,
    stage: StageStatusEnum,
    update_request: StageUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProgressResponse:
    """Update an individual stage status.

    Args:
        project_id: The ID of the project
        stage: The stage to update (requirements, prd, stories, mockups, export)
        update_request: Contains the new status value

    Returns:
        Updated progress response with all stage statuses and recalculated progress
    """
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    field_name, status_enum = STAGE_STATUS_MAPPING[stage]

    # Validate the status value
    try:
        new_status = status_enum(update_request.status)
    except ValueError:
        valid_values = [e.value for e in status_enum]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status '{update_request.status}' for stage '{stage.value}'. Valid values are: {valid_values}",
        )

    # Update the stage status
    setattr(project, field_name, new_status)
    db.commit()
    db.refresh(project)

    return ProgressResponse(
        requirements_status=project.requirements_status.value,
        prd_status=project.prd_status.value,
        stories_status=project.stories_status.value,
        mockups_status=project.mockups_status.value,
        export_status=project.export_status.value,
        progress=calculate_progress(
            requirements_status=project.requirements_status.value,
            prd_status=project.prd_status.value,
            stories_status=project.stories_status.value,
            mockups_status=project.mockups_status.value,
            export_status=project.export_status.value,
        ),
    )
