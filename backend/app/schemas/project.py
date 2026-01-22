"""Pydantic schemas for Project API request/response validation."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ProjectCreate(BaseModel):
    """Schema for creating a new project."""

    name: str
    description: Optional[str] = None


class ProjectUpdate(BaseModel):
    """Schema for updating an existing project."""

    name: Optional[str] = None
    description: Optional[str] = None


class ProjectResponse(BaseModel):
    """Schema for project response with all fields."""

    id: str
    name: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProjectList(BaseModel):
    """Schema for list of projects."""

    projects: list[ProjectResponse]
