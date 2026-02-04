"""JiraStory model for storing JIRA epic stories."""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.sqlite import CHAR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class JiraStory(Base):
    """JiraStory model for storing generated JIRA epic stories."""

    __tablename__ = "jira_story"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)  # 50000 chars - using Text
    problem_statement: Mapped[str] = mapped_column(Text, nullable=True)  # 500000 chars - using Text
    target_user_roles: Mapped[str] = mapped_column(Text, nullable=True)  # 50000 chars - using Text
    data_sources: Mapped[str] = mapped_column(Text, nullable=True)  # 500000 chars - using Text
    business_rules: Mapped[str] = mapped_column(Text, nullable=True)  # 500000 chars - using Text
    response_example: Mapped[str] = mapped_column(Text, nullable=True)  # 500000 chars - using Text
    acceptance_criteria: Mapped[str] = mapped_column(Text, nullable=True)  # 500000 chars - using Text
    reporter: Mapped[str] = mapped_column(String(100), nullable=True)
    notes: Mapped[str] = mapped_column(Text, nullable=True)  # 500000 chars - using Text
    parent_jira_id: Mapped[int] = mapped_column(Integer, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    project = relationship("Project", back_populates="jira_stories")

    # Indexes for efficient queries
    __table_args__ = (
        Index("ix_jira_story_project_id", "project_id"),
        Index("ix_jira_story_parent_jira_id", "parent_jira_id"),
        Index("ix_jira_story_created_at", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<JiraStory(id={self.id}, title={self.title}, project_id={self.project_id})>"
