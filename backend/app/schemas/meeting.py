"""Pydantic schemas for Meeting API request/response validation."""

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel

from app.models.meeting_recap import MeetingStatus, InputType
from app.models.meeting_item import Section


class MeetingUpload(BaseModel):
    """Schema for uploading meeting notes."""

    project_id: str
    title: str
    meeting_date: date
    text: Optional[str] = None


class MeetingItemResponse(BaseModel):
    """Schema for meeting item response."""

    id: str
    section: Section
    content: str
    source_quote: Optional[str] = None
    order: int

    model_config = {"from_attributes": True}


class MeetingResponse(BaseModel):
    """Schema for meeting response with all fields including status and items list."""

    id: str
    project_id: str
    title: str
    meeting_date: date
    raw_input: str
    input_type: InputType
    status: MeetingStatus
    created_at: datetime
    processed_at: Optional[datetime] = None
    applied_at: Optional[datetime] = None
    failed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    prompt_version: Optional[str] = None
    items: list[MeetingItemResponse] = []

    model_config = {"from_attributes": True}


class MeetingListItemResponse(BaseModel):
    """Schema for meeting in list view (without items)."""

    id: str
    project_id: str
    title: str
    meeting_date: date
    input_type: InputType
    status: MeetingStatus
    created_at: datetime
    processed_at: Optional[datetime] = None
    applied_at: Optional[datetime] = None
    failed_at: Optional[datetime] = None
    error_message: Optional[str] = None

    model_config = {"from_attributes": True}


class UploadResponse(BaseModel):
    """Schema for meeting upload response."""

    job_id: str
    meeting_id: str


class MeetingItemUpdate(BaseModel):
    """Schema for updating a meeting item."""

    content: str


class MeetingItemCreate(BaseModel):
    """Schema for creating a new meeting item."""

    section: Section
    content: str
