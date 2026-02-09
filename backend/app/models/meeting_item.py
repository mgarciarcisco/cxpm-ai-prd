"""MeetingItem model for storing extracted items from meeting notes."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy import CHAR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Section(str, enum.Enum):
    """Enum for the 5 consolidated requirement sections."""
    needs_and_goals = "needs_and_goals"
    requirements = "requirements"
    scope_and_constraints = "scope_and_constraints"
    risks_and_questions = "risks_and_questions"
    action_items = "action_items"


class MeetingItem(Base):
    """MeetingItem model for storing individual extracted items from meeting notes."""

    __tablename__ = "meeting_items"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    meeting_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("meeting_recaps.id", ondelete="CASCADE"), nullable=False)
    section: Mapped[Section] = mapped_column(SAEnum(Section), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    source_quote: Mapped[str | None] = mapped_column(Text, nullable=True)
    order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    speaker: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    meeting = relationship("MeetingRecap", back_populates="items")

    # Indexes for efficient queries
    __table_args__ = (
        Index("ix_meeting_items_meeting_section", "meeting_id", "section"),
    )

    def __repr__(self) -> str:
        return f"<MeetingItem(id={self.id}, section={self.section}, order={self.order})>"
