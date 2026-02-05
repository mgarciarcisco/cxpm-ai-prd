"""Project model for organizing meeting notes and requirements."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy import CHAR
from sqlalchemy.orm import relationship

from app.database import Base


class RequirementsStatus(str, enum.Enum):
    """Status for the Requirements stage."""
    empty = "empty"
    has_items = "has_items"
    reviewed = "reviewed"


class PRDStageStatus(str, enum.Enum):
    """Status for the PRD stage."""
    empty = "empty"
    draft = "draft"
    ready = "ready"


class StoriesStatus(str, enum.Enum):
    """Status for the User Stories stage."""
    empty = "empty"
    generated = "generated"
    refined = "refined"


class MockupsStatus(str, enum.Enum):
    """Status for the Mockups stage."""
    empty = "empty"
    generated = "generated"


class ExportStatus(str, enum.Enum):
    """Status for the Export stage."""
    not_exported = "not_exported"
    exported = "exported"


class Project(Base):
    """Project model for storing project information."""

    __tablename__ = "projects"

    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    archived = Column(Boolean, nullable=False, default=False, server_default="0")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Stage status fields
    requirements_status = Column(
        SAEnum(RequirementsStatus),
        nullable=False,
        default=RequirementsStatus.empty,
        server_default="empty"
    )
    prd_status = Column(
        SAEnum(PRDStageStatus),
        nullable=False,
        default=PRDStageStatus.empty,
        server_default="empty"
    )
    stories_status = Column(
        SAEnum(StoriesStatus),
        nullable=False,
        default=StoriesStatus.empty,
        server_default="empty"
    )
    mockups_status = Column(
        SAEnum(MockupsStatus),
        nullable=False,
        default=MockupsStatus.empty,
        server_default="empty"
    )
    export_status = Column(
        SAEnum(ExportStatus),
        nullable=False,
        default=ExportStatus.not_exported,
        server_default="not_exported"
    )

    # Relationships with cascade delete
    meetings = relationship("MeetingRecap", back_populates="project", cascade="all, delete-orphan")
    requirements = relationship("Requirement", back_populates="project", cascade="all, delete-orphan")
    prds = relationship("PRD", back_populates="project", cascade="all, delete-orphan")
    user_stories = relationship("UserStory", back_populates="project", cascade="all, delete-orphan")
    story_batches = relationship("StoryBatch", back_populates="project", cascade="all, delete-orphan")

    @property
    def requirements_count(self) -> int:
        """Count of active requirements for this project."""
        return sum(1 for r in self.requirements if r.is_active)

    def __repr__(self) -> str:
        return f"<Project(id={self.id}, name={self.name})>"
