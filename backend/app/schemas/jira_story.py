"""Pydantic schemas for JIRA Story API request/response validation."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class JiraStoryCreate(BaseModel):
    """Schema for creating a JIRA story."""

    title: str = Field(..., max_length=100)
    description: Optional[str] = None
    problem_statement: Optional[str] = None
    target_user_roles: Optional[str] = None
    data_sources: Optional[str] = None
    business_rules: Optional[str] = None
    response_example: Optional[str] = None
    acceptance_criteria: Optional[str] = None
    reporter: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None
    parent_jira_id: Optional[int] = None


class JiraStoryResponse(BaseModel):
    """Schema for JIRA story response."""

    id: str
    project_id: str
    title: str
    description: Optional[str]
    problem_statement: Optional[str]
    target_user_roles: Optional[str]
    data_sources: Optional[str]
    business_rules: Optional[str]
    response_example: Optional[str]
    acceptance_criteria: Optional[str]
    reporter: Optional[str]
    notes: Optional[str]
    parent_jira_id: Optional[int]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class JiraStoriesSaveRequest(BaseModel):
    """Schema for saving multiple JIRA stories."""

    project_id: str
    epics: list[JiraStoryCreate]


class JiraStoriesSaveResponse(BaseModel):
    """Schema for save response."""

    message: str
    saved_count: int
    saved_stories: list[JiraStoryResponse]
