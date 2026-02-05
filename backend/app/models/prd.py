"""PRD model for storing Product Requirements Documents with status lifecycle."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy import Enum as SAEnum
from sqlalchemy import CHAR
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.database import Base


class PRDMode(str, enum.Enum):
    """Enum for PRD generation modes."""
    DRAFT = "draft"
    DETAILED = "detailed"


class PRDStatus(str, enum.Enum):
    """Enum for PRD generation status lifecycle."""
    QUEUED = "queued"
    GENERATING = "generating"
    PARTIAL = "partial"  # Some sections completed, some failed
    READY = "ready"
    FAILED = "failed"
    CANCELLED = "cancelled"
    ARCHIVED = "archived"


class PRD(Base):
    """PRD model for storing Product Requirements Documents."""

    __tablename__ = "prds"
    __table_args__ = (
        UniqueConstraint("project_id", "version", name="uq_prds_project_version"),
    )

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=True)
    mode: Mapped[PRDMode] = mapped_column(SAEnum(PRDMode), nullable=False)
    sections = Column(JSON, nullable=True)
    raw_markdown = Column(Text, nullable=True)

    # Status lifecycle
    status: Mapped[PRDStatus] = mapped_column(SAEnum(PRDStatus), default=PRDStatus.QUEUED, nullable=False)
    error_message = Column(Text, nullable=True)

    # Section progress tracking for staged generation
    current_stage: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sections_completed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sections_total: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Audit fields
    created_by: Mapped[str] = mapped_column(String(255), nullable=True)
    updated_by: Mapped[str] = mapped_column(String(255), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    deleted_at = Column(DateTime, nullable=True)

    # Relationships
    project = relationship("Project", back_populates="prds")

    def __repr__(self) -> str:
        return f"<PRD(id={self.id}, title={self.title}, version={self.version}, status={self.status})>"
