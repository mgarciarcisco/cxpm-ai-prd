"""Pydantic schemas for Meeting API request/response validation."""

from datetime import date, datetime

from pydantic import BaseModel

from app.models.meeting_item import Section
from app.models.meeting_recap import InputType, MeetingStatus


class MeetingUpload(BaseModel):
    """Schema for uploading meeting notes."""

    project_id: str | None = None  # Optional for unified flow
    title: str
    meeting_date: date
    text: str | None = None


class MeetingItemResponse(BaseModel):
    """Schema for meeting item response."""

    id: str
    section: Section
    content: str
    source_quote: str | None = None
    order: int

    model_config = {"from_attributes": True}


class MeetingResponse(BaseModel):
    """Schema for meeting response with all fields including status and items list."""

    id: str
    project_id: str | None = None  # Optional for unified flow
    title: str
    meeting_date: date
    raw_input: str
    input_type: InputType
    status: MeetingStatus
    created_at: datetime
    processed_at: datetime | None = None
    applied_at: datetime | None = None
    failed_at: datetime | None = None
    error_message: str | None = None
    prompt_version: str | None = None
    items: list[MeetingItemResponse] = []

    model_config = {"from_attributes": True}


class MeetingListItemResponse(BaseModel):
    """Schema for meeting in list view (without items)."""

    id: str
    project_id: str | None = None  # Optional for unified flow
    title: str
    meeting_date: date
    input_type: InputType
    status: MeetingStatus
    created_at: datetime
    processed_at: datetime | None = None
    applied_at: datetime | None = None
    failed_at: datetime | None = None
    error_message: str | None = None

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


class MeetingItemReorderRequest(BaseModel):
    """Schema for reordering meeting items within a section."""

    section: Section
    item_ids: list[str]


class MatchedRequirementResponse(BaseModel):
    """Schema for a matched requirement in conflict detection."""

    id: str
    section: Section
    content: str

    model_config = {"from_attributes": True}


class ConflictResultResponse(BaseModel):
    """Schema for a single conflict detection result."""

    item_id: str
    item_section: Section
    item_content: str
    decision: str  # 'added', 'skipped_duplicate', 'skipped_semantic', 'conflict'
    reason: str
    matched_requirement: MatchedRequirementResponse | None = None
    classification: str | None = None  # 'duplicate', 'new', 'refinement', 'contradiction'


class ApplyResponse(BaseModel):
    """Schema for apply endpoint response with categorized results."""

    added: list[ConflictResultResponse] = []
    skipped: list[ConflictResultResponse] = []
    conflicts: list[ConflictResultResponse] = []


class MergeSuggestionRequest(BaseModel):
    """Schema for requesting a merge suggestion."""

    existing: str
    new: str


class MergeSuggestionResponse(BaseModel):
    """Schema for merge suggestion response."""

    merged_text: str


class ResolveDecision(BaseModel):
    """Schema for a single decision in the resolve request."""

    item_id: str
    decision: str  # 'added', 'skipped_duplicate', 'skipped_semantic', 'conflict_keep_existing', 'conflict_replaced', 'conflict_kept_both', 'conflict_merged'
    merged_text: str | None = None  # Required for 'conflict_merged' decision
    matched_requirement_id: str | None = None  # Required for conflict decisions


class ResolveRequest(BaseModel):
    """Schema for the resolve endpoint request."""

    decisions: list[ResolveDecision]


class ResolveResponse(BaseModel):
    """Schema for the resolve endpoint response with counts."""

    added: int = 0
    skipped: int = 0
    merged: int = 0
    replaced: int = 0
