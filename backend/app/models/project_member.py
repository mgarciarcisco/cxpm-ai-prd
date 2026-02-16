"""Project member model for role-based project sharing."""

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import CHAR, Column, DateTime, ForeignKey, UniqueConstraint, Index
from sqlalchemy import Enum as SAEnum

from app.database import Base


class ProjectRole(str, enum.Enum):
    editor = "editor"
    viewer = "viewer"


class ProjectMember(Base):
    """Tracks editor/viewer memberships for shared projects."""

    __tablename__ = "project_members"

    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(CHAR(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(SAEnum(ProjectRole), nullable=False)
    added_by = Column(CHAR(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        UniqueConstraint("project_id", "user_id", name="uq_project_members_project_user"),
        Index("ix_project_members_project_id", "project_id"),
        Index("ix_project_members_user_id", "user_id"),
    )

    def __repr__(self) -> str:
        return f"<ProjectMember(project_id={self.project_id}, user_id={self.user_id}, role={self.role})>"
