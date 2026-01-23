"""RequirementSource model for tracking which meetings contributed to each requirement."""

import uuid
from datetime import datetime

from sqlalchemy import Column, Text, DateTime, ForeignKey, Index
from sqlalchemy.dialects.sqlite import CHAR
from sqlalchemy.orm import relationship, Mapped, mapped_column

from app.database import Base


class RequirementSource(Base):
    """RequirementSource model for linking requirements to their source meetings and meeting items."""

    __tablename__ = "requirement_sources"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    requirement_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("requirements.id", ondelete="CASCADE"), nullable=False)
    meeting_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("meeting_recaps.id", ondelete="SET NULL"), nullable=True)
    meeting_item_id: Mapped[str | None] = mapped_column(CHAR(36), ForeignKey("meeting_items.id", ondelete="SET NULL"), nullable=True)
    source_quote: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    requirement = relationship("Requirement", back_populates="sources")
    meeting = relationship("MeetingRecap")
    meeting_item = relationship("MeetingItem")

    # Index for traceability queries
    __table_args__ = (
        Index("ix_requirement_sources_meeting_id", "meeting_id"),
    )

    def __repr__(self) -> str:
        return f"<RequirementSource(id={self.id}, requirement_id={self.requirement_id}, meeting_id={self.meeting_id})>"
