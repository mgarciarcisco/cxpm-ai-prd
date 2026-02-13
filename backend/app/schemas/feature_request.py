"""Pydantic schemas for feature request endpoints."""

import enum
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class FeatureCategorySchema(str, enum.Enum):
    requirements = "requirements"
    jira_integration = "jira_integration"
    export = "export"
    ui_ux = "ui_ux"
    new_capability = "new_capability"


class FeatureStatusSchema(str, enum.Enum):
    submitted = "submitted"
    under_review = "under_review"
    planned = "planned"
    in_progress = "in_progress"
    shipped = "shipped"
    declined = "declined"


class FeatureRequestCreate(BaseModel):
    """Schema for creating a feature request."""
    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1)
    category: FeatureCategorySchema


class FeatureRequestUpdate(BaseModel):
    """Schema for admin editing a feature request."""
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, min_length=1)
    category: Optional[FeatureCategorySchema] = None


class FeatureStatusUpdate(BaseModel):
    """Schema for updating feature request status with optional admin response."""
    status: FeatureStatusSchema
    admin_response: Optional[str] = None


class CommentCreate(BaseModel):
    """Schema for creating a comment."""
    content: str = Field(..., min_length=1)


class CommentUpdate(BaseModel):
    """Schema for updating a comment."""
    content: str = Field(..., min_length=1)


class CommentResponse(BaseModel):
    """Response schema for a comment."""
    id: str
    feature_request_id: str
    user_id: str
    user_name: str
    content: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class FeatureRequestResponse(BaseModel):
    """Response schema for a feature request with enriched fields."""
    id: str
    title: str
    description: str
    category: FeatureCategorySchema
    status: FeatureStatusSchema
    admin_response: Optional[str] = None
    submitter_id: str
    submitter_name: str
    upvote_count: int = 0
    user_has_upvoted: bool = False
    comment_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class FeatureRequestListResponse(BaseModel):
    """Paginated list of feature requests."""
    items: list[FeatureRequestResponse]
    total: int
    page: int
    per_page: int


class UpvoteResponse(BaseModel):
    """Response for upvote toggle."""
    upvoted: bool
    upvote_count: int
