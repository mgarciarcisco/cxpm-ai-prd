"""MeetingItemDecision model for recording all decisions during the apply process."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Index, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.sqlite import CHAR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Decision(str, enum.Enum):
    """Enum for tracking the decision made for each meeting item during apply."""

    added = "added"
    skipped_duplicate = "skipped_duplicate"
    skipped_semantic = "skipped_semantic"
    conflict_keep_existing = "conflict_keep_existing"
    conflict_replaced = "conflict_replaced"
    conflict_kept_both = "conflict_kept_both"
    conflict_merged = "conflict_merged"


class MeetingItemDecision(Base):
    """MeetingItemDecision model for recording all decisions during the apply process."""

    __tablename__ = "meeting_item_decisions"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    meeting_item_id: Mapped[str] = mapped_column(
        CHAR(36), ForeignKey("meeting_items.id", ondelete="CASCADE"), nullable=False
    )
    decision: Mapped[Decision] = mapped_column(SAEnum(Decision), nullable=False)
    matched_requirement_id: Mapped[str | None] = mapped_column(
        CHAR(36), ForeignKey("requirements.id", ondelete="SET NULL"), nullable=True
    )
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    meeting_item = relationship("MeetingItem")
    matched_requirement = relationship("Requirement")

    # Indexes
    __table_args__ = (
        Index("ix_meeting_item_decisions_meeting_item_id", "meeting_item_id"),
    )

    def __repr__(self) -> str:
        return f"<MeetingItemDecision(id={self.id}, decision={self.decision})>"
