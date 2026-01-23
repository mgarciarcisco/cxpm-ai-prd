"""MeetingRecap model for storing uploaded meeting notes with status lifecycle."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import Column, Date, DateTime, ForeignKey, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.sqlite import CHAR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class InputType(str, enum.Enum):
    """Enum for meeting input file types."""
    txt = "txt"
    md = "md"


class MeetingStatus(str, enum.Enum):
    """Enum for meeting processing status lifecycle."""
    pending = "pending"
    processing = "processing"
    processed = "processed"
    failed = "failed"
    applied = "applied"


class MeetingRecap(Base):
    """MeetingRecap model for storing meeting notes and tracking processing status."""

    __tablename__ = "meeting_recaps"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    meeting_date = Column(Date, nullable=False)
    raw_input: Mapped[str] = mapped_column(Text, nullable=False)
    input_type: Mapped[InputType] = mapped_column(SAEnum(InputType), nullable=False)

    # Status lifecycle
    status: Mapped[MeetingStatus] = mapped_column(SAEnum(MeetingStatus), default=MeetingStatus.pending, nullable=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    processed_at = Column(DateTime, nullable=True)
    applied_at = Column(DateTime, nullable=True)
    failed_at = Column(DateTime, nullable=True)

    # Processing metadata
    error_message = Column(Text, nullable=True)
    prompt_version = Column(String(100), nullable=True)

    # Relationships
    project = relationship("Project", back_populates="meetings")
    items = relationship("MeetingItem", back_populates="meeting", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<MeetingRecap(id={self.id}, title={self.title}, status={self.status})>"
