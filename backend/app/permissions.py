"""Centralized permission helper for project access control."""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.user import User


def get_project_with_access(
    project_id: str,
    current_user: User,
    db: Session,
    require_role: str | None = None,
) -> tuple[Project, str]:
    """Check user access to a project and return (project, role).

    Args:
        project_id: The project UUID.
        current_user: The authenticated user.
        db: Database session.
        require_role: Minimum role required.
            None = any access (viewer, editor, owner)
            "editor" = editor or owner
            "owner" = owner only

    Returns:
        Tuple of (project, role_string) where role is "owner", "editor", or "viewer".

    Raises:
        HTTPException 404: Project not found or user has no access.
        HTTPException 403: User has access but insufficient role.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    # Owner always has full access
    if project.user_id == current_user.id:
        return project, "owner"

    # Check membership
    member = (
        db.query(ProjectMember)
        .filter(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == current_user.id,
        )
        .first()
    )

    if not member:
        # Return 404 to avoid leaking project existence
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    role = member.role.value

    if require_role == "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the project owner can perform this action",
        )
    if require_role == "editor" and role == "viewer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Viewers cannot modify this project",
        )

    return project, role
