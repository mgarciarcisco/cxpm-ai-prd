"""UserStory model for storing user stories with format and status tracking."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.sqlite import CHAR
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.database import Base


class StoryFormat(str, enum.Enum):
    """Enum for user story format types."""
    CLASSIC = "classic"
    JOB_STORY = "job_story"


class StoryStatus(str, enum.Enum):
    """Enum for user story status lifecycle."""
    DRAFT = "draft"
    READY = "ready"
    EXPORTED = "exported"


class StorySize(str, enum.Enum):
    """Enum for user story size estimation."""
    XS = "xs"
    S = "s"
    M = "m"
    L = "l"
    XL = "xl"


class UserStory(Base):
    """UserStory model for storing user stories with metadata."""

    __tablename__ = "user_stories"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    batch_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("story_batches.id", ondelete="SET NULL"), nullable=True)
    story_number: Mapped[int] = mapped_column(Integer, nullable=False)
    format: Mapped[StoryFormat] = mapped_column(SAEnum(StoryFormat), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    acceptance_criteria = Column(JSON, nullable=True)
    order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    labels = Column(JSON, nullable=True)
    size: Mapped[StorySize] = mapped_column(SAEnum(StorySize), nullable=True)
    requirement_ids = Column(JSON, nullable=True)

    # Status lifecycle
    status: Mapped[StoryStatus] = mapped_column(SAEnum(StoryStatus), default=StoryStatus.DRAFT, nullable=False)

    # Audit fields
    created_by: Mapped[str] = mapped_column(String(255), nullable=True)
    updated_by: Mapped[str] = mapped_column(String(255), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    deleted_at = Column(DateTime, nullable=True)

    # Relationships
    project = relationship("Project", back_populates="user_stories")
    batch = relationship("StoryBatch", back_populates="stories")

    @property
    def story_id(self) -> str:
        """Returns the formatted story ID like 'US-001'."""
        return f"US-{self.story_number:03d}"

    def __repr__(self) -> str:
        return f"<UserStory(id={self.id}, story_id={self.story_id}, title={self.title}, status={self.status})>"
