"""Project member management API endpoints (sharing)."""

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.activity import log_activity_safe
from app.auth import get_current_user
from app.database import get_db
from app.models.notification import NotificationType
from app.models.project_member import ProjectMember
from app.models.user import User
from app.notifications import create_notification_safe
from app.permissions import get_project_with_access
from app.schemas.project_member import (
    AddMemberRequest,
    ProjectMemberResponse,
    UpdateMemberRoleRequest,
    UserSearchResponse,
)

router = APIRouter(prefix="/api/projects", tags=["project-members"])


@router.get("/{project_id}/members", response_model=list[ProjectMemberResponse])
def list_members(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ProjectMemberResponse]:
    """List all members of a project. Any member can view the list."""
    project, _role = get_project_with_access(project_id, current_user, db)

    # Owner is always first
    owner = db.query(User).filter(User.id == project.user_id).first()
    result: list[ProjectMemberResponse] = []
    if owner:
        result.append(ProjectMemberResponse(
            user_id=owner.id,
            name=owner.name,
            email=owner.email,
            role="owner",
            added_at=project.created_at,
        ))

    # Then editors and viewers
    members = (
        db.query(ProjectMember, User)
        .join(User, ProjectMember.user_id == User.id)
        .filter(ProjectMember.project_id == project_id)
        .order_by(ProjectMember.created_at)
        .all()
    )
    for member, user in members:
        result.append(ProjectMemberResponse(
            user_id=user.id,
            name=user.name,
            email=user.email,
            role=member.role.value,
            added_at=member.created_at,
        ))

    return result


@router.post(
    "/{project_id}/members",
    response_model=ProjectMemberResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_member(
    project_id: str,
    payload: AddMemberRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProjectMemberResponse:
    """Add a member to a project. Owner only."""
    project, _role = get_project_with_access(project_id, current_user, db, require_role="owner")

    # Cannot add yourself
    if payload.user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot add yourself as a member",
        )

    # Verify the target user exists, is active, and is approved
    target_user = db.query(User).filter(
        User.id == payload.user_id,
        User.is_active == True,  # noqa: E712
        User.is_approved == True,  # noqa: E712
    ).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Check for duplicate membership
    existing = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == payload.user_id,
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a member of this project",
        )

    member = ProjectMember(
        project_id=project_id,
        user_id=payload.user_id,
        role=payload.role,
        added_by=current_user.id,
    )
    db.add(member)
    db.commit()
    db.refresh(member)

    # Notify the added user
    create_notification_safe(
        db,
        user_id=payload.user_id,
        notification_type=NotificationType.project_member_added,
        title="Project Shared",
        message=f"{current_user.name} shared '{project.name}' with you as {payload.role.value}",
        resource_type="project",
        resource_id=project_id,
    )

    log_activity_safe(
        db, current_user.id, "project.member_added", "project", project_id,
        {"member_user_id": payload.user_id, "member_email": target_user.email, "role": payload.role.value},
        request,
    )

    return ProjectMemberResponse(
        user_id=target_user.id,
        name=target_user.name,
        email=target_user.email,
        role=member.role.value,
        added_at=member.created_at,
    )


@router.patch("/{project_id}/members/{user_id}", response_model=ProjectMemberResponse)
def update_member_role(
    project_id: str,
    user_id: str,
    payload: UpdateMemberRoleRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProjectMemberResponse:
    """Change a member's role. Owner only."""
    project, _role = get_project_with_access(project_id, current_user, db, require_role="owner")

    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == user_id,
    ).first()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        )

    old_role = member.role.value
    member.role = payload.role
    db.commit()
    db.refresh(member)

    target_user = db.query(User).filter(User.id == user_id).first()

    log_activity_safe(
        db, current_user.id, "project.member_role_changed", "project", project_id,
        {"member_user_id": user_id, "old_role": old_role, "new_role": payload.role.value},
        request,
    )

    return ProjectMemberResponse(
        user_id=target_user.id,
        name=target_user.name,
        email=target_user.email,
        role=member.role.value,
        added_at=member.created_at,
    )


@router.delete("/{project_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    project_id: str,
    user_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Remove a member from a project. Owner only."""
    project, _role = get_project_with_access(project_id, current_user, db, require_role="owner")

    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == user_id,
    ).first()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        )

    target_user = db.query(User).filter(User.id == user_id).first()
    member_email = target_user.email if target_user else "unknown"

    db.delete(member)
    db.commit()

    # Notify the removed user
    create_notification_safe(
        db,
        user_id=user_id,
        notification_type=NotificationType.project_member_removed,
        title="Access Removed",
        message=f"Your access to '{project.name}' has been removed",
        resource_type="project",
        resource_id=project_id,
    )

    log_activity_safe(
        db, current_user.id, "project.member_removed", "project", project_id,
        {"member_user_id": user_id, "member_email": member_email},
        request,
    )


# --- User search endpoint (placed on /api/users prefix) ---

users_router = APIRouter(prefix="/api/users", tags=["users"])


@users_router.get("/search", response_model=list[UserSearchResponse])
def search_users(
    q: str = Query(..., min_length=2, max_length=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[UserSearchResponse]:
    """Search for active, approved users by name or email. Min 2 chars."""
    search_term = f"%{q}%"
    users = (
        db.query(User)
        .filter(
            User.is_active == True,  # noqa: E712
            User.is_approved == True,  # noqa: E712
            User.id != current_user.id,
            or_(User.name.ilike(search_term), User.email.ilike(search_term)),
        )
        .order_by(User.name)
        .limit(20)
        .all()
    )
    return [UserSearchResponse(id=u.id, name=u.name, email=u.email) for u in users]
