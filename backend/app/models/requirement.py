"""Requirement model for storing accumulated requirements from meeting recaps."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy import CHAR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.meeting_item import Section


class Requirement(Base):
    """Requirement model for storing requirements extracted and accumulated from meetings."""

    __tablename__ = "requirements"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    section: Mapped[Section] = mapped_column(SAEnum(Section), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    project = relationship("Project", back_populates="requirements")
    sources = relationship("RequirementSource", back_populates="requirement", cascade="all, delete-orphan")
    history = relationship("RequirementHistory", back_populates="requirement", cascade="all, delete-orphan")

    # Indexes for efficient queries
    __table_args__ = (
        Index("ix_requirements_project_section", "project_id", "section"),
        Index("ix_requirements_project_active", "project_id", "is_active"),
    )

    def __repr__(self) -> str:
        return f"<Requirement(id={self.id}, section={self.section}, order={self.order}, is_active={self.is_active})>"
