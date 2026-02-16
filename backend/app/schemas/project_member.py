"""Pydantic schemas for project member (sharing) API."""

from datetime import datetime

from pydantic import BaseModel

from app.models.project_member import ProjectRole


class AddMemberRequest(BaseModel):
    user_id: str
    role: ProjectRole


class UpdateMemberRoleRequest(BaseModel):
    role: ProjectRole


class ProjectMemberResponse(BaseModel):
    user_id: str
    name: str
    email: str
    role: str
    added_at: datetime | None = None

    model_config = {"from_attributes": True}


class UserSearchResponse(BaseModel):
    id: str
    name: str
    email: str

    model_config = {"from_attributes": True}
