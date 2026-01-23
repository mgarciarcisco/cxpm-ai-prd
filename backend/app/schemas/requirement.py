"""Pydantic schemas for Requirements API request/response validation."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.meeting_item import Section
from app.models.requirement_history import Actor, Action


class RequirementSourceResponse(BaseModel):
    """Schema for requirement source response (link to meeting)."""

    id: str
    meeting_id: Optional[str] = None
    meeting_title: Optional[str] = None
    meeting_item_id: Optional[str] = None
    source_quote: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class RequirementHistoryResponse(BaseModel):
    """Schema for requirement history entry."""

    id: str
    actor: Actor
    action: Action
    old_content: Optional[str] = None
    new_content: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class RequirementResponse(BaseModel):
    """Schema for requirement response with sources and history count."""

    id: str
    section: Section
    content: str
    order: int
    sources: list[RequirementSourceResponse] = []
    history_count: int = 0

    model_config = {"from_attributes": True}


class RequirementUpdate(BaseModel):
    """Schema for updating a requirement."""

    content: str


class RequirementsListResponse(BaseModel):
    """Schema for requirements list response grouped by section."""

    problems: list[RequirementResponse] = []
    user_goals: list[RequirementResponse] = []
    functional_requirements: list[RequirementResponse] = []
    data_needs: list[RequirementResponse] = []
    constraints: list[RequirementResponse] = []
    non_goals: list[RequirementResponse] = []
    risks_assumptions: list[RequirementResponse] = []
    open_questions: list[RequirementResponse] = []
    action_items: list[RequirementResponse] = []


class RequirementReorderRequest(BaseModel):
    """Schema for reordering requirements within a section."""

    section: Section
    requirement_ids: list[str]
