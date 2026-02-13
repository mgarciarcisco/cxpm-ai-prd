"""Bug report model for user-reported issues."""

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import CHAR, Column, DateTime, Enum, Index, String, Text, ForeignKey

from app.database import Base


class BugSeverity(str, enum.Enum):
    blocker = "blocker"
    major = "major"
    minor = "minor"


class BugStatus(str, enum.Enum):
    open = "open"
    investigating = "investigating"
    fixed = "fixed"
    closed = "closed"


class BugReport(Base):
    """Bug report submitted by a user."""

    __tablename__ = "bug_reports"

    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    severity = Column(Enum(BugSeverity), nullable=False, default=BugSeverity.minor)
    status = Column(Enum(BugStatus), nullable=False, default=BugStatus.open)
    steps_to_reproduce = Column(Text, nullable=True)
    screenshot_path = Column(String(500), nullable=True)
    page_url = Column(String(500), nullable=True)
    browser_info = Column(String(500), nullable=True)
    reporter_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        Index("ix_bug_reports_reporter_id", "reporter_id"),
        Index("ix_bug_reports_status", "status"),
        Index("ix_bug_reports_created_at", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<BugReport(id={self.id}, title={self.title})>"
