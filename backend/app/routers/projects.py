"""Project CRUD API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from collections import defaultdict

from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.activity import log_activity_safe
from app.auth import get_current_user
from app.database import get_db
from app.models import (
    ExportStatus,
    JiraStory,
    MeetingRecap,
    MockupsStatus,
    PRDStageStatus,
    Project,
    Requirement,
    RequirementsStatus,
    StoriesStatus,
)
from app.models.project_member import ProjectMember
from app.models.user import User
from app.permissions import get_project_with_access
from app.schemas import (
    MeetingListItemResponse,
    ProgressResponse,
    ProjectCreate,
    ProjectListResponse,
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
def create_project(project: ProjectCreate, request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Project:
    """Create a new project."""
    db_project = Project(
        name=project.name,
        description=project.description,
        user_id=current_user.id,
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    log_activity_safe(db, current_user.id, "project.created", "project", db_project.id, {"name": db_project.name}, request)
    return db_project


@router.get("", response_model=ProjectListResponse)
def list_projects(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> ProjectListResponse:
    """Get list of projects: owned and shared."""
    from app.schemas.project import ProjectResponse

    # Owned projects — eager-load members to avoid N+1
    owned_projects = (
        db.query(Project)
        .options(selectinload(Project.members))
        .filter(Project.user_id == current_user.id)
        .all()
    )

    # Batch-load member users for all owned projects in one query
    all_member_user_ids = [m.user_id for p in owned_projects for m in p.members]
    member_users_by_id: dict[str, User] = {}
    if all_member_user_ids:
        member_users = db.query(User).filter(User.id.in_(all_member_user_ids)).all()
        member_users_by_id = {u.id: u for u in member_users}

    owned_result = []
    for p in owned_projects:
        resp = ProjectResponse.model_validate(p).model_dump()
        resp["role"] = "owner"
        resp["members"] = [
            {"user_id": m.user_id, "name": member_users_by_id[m.user_id].name, "role": m.role.value}
            for m in p.members
            if m.user_id in member_users_by_id
        ]
        owned_result.append(resp)

    # Shared projects — eager-load owner to avoid N+1
    shared_rows = (
        db.query(Project, ProjectMember)
        .join(ProjectMember, ProjectMember.project_id == Project.id)
        .options(selectinload(Project.owner))
        .filter(ProjectMember.user_id == current_user.id)
        .all()
    )

    shared_result = []
    shared_project_ids = [p.id for p, _membership in shared_rows]
    shared_members_by_project: dict[str, list[ProjectMember]] = defaultdict(list)
    shared_member_users_by_id: dict[str, User] = {}

    if shared_project_ids:
        shared_members = db.query(ProjectMember).filter(ProjectMember.project_id.in_(shared_project_ids)).all()
        for member in shared_members:
            shared_members_by_project[member.project_id].append(member)

        shared_member_user_ids = list({m.user_id for m in shared_members})
        if shared_member_user_ids:
            shared_member_users = db.query(User).filter(User.id.in_(shared_member_user_ids)).all()
            shared_member_users_by_id = {u.id: u for u in shared_member_users}

    for p, membership in shared_rows:
        resp = ProjectResponse.model_validate(p).model_dump()
        resp["role"] = membership.role.value
        resp["owner_name"] = p.owner.name if p.owner else None
        resp["members"] = [
            {"user_id": m.user_id, "name": shared_member_users_by_id[m.user_id].name, "role": m.role.value}
            for m in shared_members_by_project.get(p.id, [])
            if m.user_id in shared_member_users_by_id
        ]
        shared_result.append(resp)

    return ProjectListResponse(owned=owned_result, shared=shared_result)


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(project_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get a single project by ID."""
    project, role = get_project_with_access(project_id, current_user, db)
    resp = ProjectResponse.model_validate(project).model_dump()
    resp["role"] = role
    if role != "owner":
        resp["owner_name"] = project.owner.name if project.owner else None
    return resp


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: str,
    project_update: ProjectUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Project:
    """Update an existing project."""
    project, _role = get_project_with_access(project_id, current_user, db, require_role="owner")

    # Update only provided fields
    update_data = project_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)

    db.commit()
    db.refresh(project)
    log_activity_safe(db, current_user.id, "project.updated", "project", project_id, {"changed_fields": list(update_data.keys())}, request)
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: str, request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> None:
    """Delete a project."""
    project, _role = get_project_with_access(project_id, current_user, db, require_role="owner")

    project_name = project.name
    db.delete(project)
    db.commit()
    log_activity_safe(db, current_user.id, "project.deleted", "project", project_id, {"name": project_name}, request)


@router.get("/{project_id}/meetings", response_model=list[MeetingListItemResponse])
def list_project_meetings(project_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[MeetingRecap]:
    """Get list of meetings for a project."""
    project, _role = get_project_with_access(project_id, current_user, db)

    return db.query(MeetingRecap).filter(MeetingRecap.project_id == project_id).all()


@router.get("/{project_id}/stats", response_model=ProjectStatsResponse)
def get_project_stats(project_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> ProjectStatsResponse:
    """Get project statistics including meeting count, requirement counts, and last activity."""
    project, _role = get_project_with_access(project_id, current_user, db)

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

    # Find last activity — most recent timestamp across meetings, requirements, and project
    candidates = [project.updated_at, project.created_at]

    last_meeting_applied = db.query(func.max(MeetingRecap.applied_at)).filter(
        MeetingRecap.project_id == project_id,
        MeetingRecap.applied_at.isnot(None)
    ).scalar()
    if last_meeting_applied:
        candidates.append(last_meeting_applied)

    last_meeting_created = db.query(func.max(MeetingRecap.created_at)).filter(
        MeetingRecap.project_id == project_id
    ).scalar()
    if last_meeting_created:
        candidates.append(last_meeting_created)

    last_requirement_updated = db.query(func.max(Requirement.updated_at)).filter(
        Requirement.project_id == project_id
    ).scalar()
    if last_requirement_updated:
        candidates.append(last_requirement_updated)

    last_activity = max(candidates)

    # Count Jira stories (epics) for this project
    jira_story_count = db.query(func.count(JiraStory.id)).filter(
        JiraStory.project_id == project_id
    ).scalar() or 0

    return ProjectStatsResponse(
        meeting_count=meeting_count,
        requirement_count=total_requirement_count,
        requirement_counts_by_section=requirement_counts_by_section,
        last_activity=last_activity,
        jira_story_count=jira_story_count,
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
    project, _role = get_project_with_access(project_id, current_user, db, require_role="owner")

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
