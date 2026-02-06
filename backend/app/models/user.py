"""User model for email/password authentication."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy import CHAR

from app.database import Base


class User(Base):
    """User model for authentication and ownership."""

    __tablename__ = "users"

    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    last_login_at = Column(DateTime, nullable=True)

    # Approval fields
    is_approved = Column(Boolean, default=False, nullable=False, index=True)
    approved_by = Column(CHAR(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at = Column(DateTime, nullable=True)

    # Activity tracking
    last_active_at = Column(DateTime, nullable=True, index=True)

    # Deactivation fields
    deactivated_at = Column(DateTime, nullable=True)
    deactivated_by = Column(CHAR(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Security fields
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime, nullable=True)
    token_invalid_before = Column(DateTime, nullable=True)

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email})>"
