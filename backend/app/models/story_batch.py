"""StoryBatch model for tracking user story generation runs."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy import CHAR
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.database import Base
from app.models.user_story import StoryFormat


class StoryBatchStatus(str, enum.Enum):
    """Enum for story batch generation status lifecycle."""
    QUEUED = "queued"
    GENERATING = "generating"
    READY = "ready"
    FAILED = "failed"
    CANCELLED = "cancelled"


class StoryBatch(Base):
    """StoryBatch model for tracking each story generation run."""

    __tablename__ = "story_batches"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    format: Mapped[StoryFormat] = mapped_column(SAEnum(StoryFormat), nullable=False)
    section_filter = Column(JSON, nullable=True)
    story_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Status lifecycle
    status: Mapped[StoryBatchStatus] = mapped_column(SAEnum(StoryBatchStatus), default=StoryBatchStatus.QUEUED, nullable=False)
    error_message = Column(String(2000), nullable=True)

    # Audit fields
    created_by: Mapped[str] = mapped_column(String(255), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    project = relationship("Project", back_populates="story_batches")
    stories = relationship("UserStory", back_populates="batch")

    def __repr__(self) -> str:
        return f"<StoryBatch(id={self.id}, format={self.format}, story_count={self.story_count}, status={self.status})>"
