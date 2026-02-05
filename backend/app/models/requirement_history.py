"""RequirementHistory model for auditing all changes to requirements."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Index, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy import CHAR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Actor(str, enum.Enum):
    """Enum for tracking who made a change to a requirement."""

    system = "system"
    user = "user"
    ai_extraction = "ai_extraction"
    ai_merge = "ai_merge"


class Action(str, enum.Enum):
    """Enum for tracking what type of change was made to a requirement."""

    created = "created"
    modified = "modified"
    deactivated = "deactivated"
    reactivated = "reactivated"
    merged = "merged"


class RequirementHistory(Base):
    """RequirementHistory model for auditing all changes to requirements."""

    __tablename__ = "requirement_history"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    requirement_id: Mapped[str] = mapped_column(
        CHAR(36), ForeignKey("requirements.id", ondelete="CASCADE"), nullable=False
    )
    meeting_id: Mapped[str | None] = mapped_column(
        CHAR(36), ForeignKey("meeting_recaps.id", ondelete="SET NULL"), nullable=True
    )
    actor: Mapped[Actor] = mapped_column(SAEnum(Actor), nullable=False)
    action: Mapped[Action] = mapped_column(SAEnum(Action), nullable=False)
    old_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_content: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    requirement = relationship("Requirement", back_populates="history")
    meeting = relationship("MeetingRecap")

    # Indexes
    __table_args__ = (Index("ix_requirement_history_requirement_id", "requirement_id"),)

    def __repr__(self) -> str:
        return f"<RequirementHistory(id={self.id}, actor={self.actor}, action={self.action})>"
