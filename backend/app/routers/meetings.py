"""Meeting API endpoints."""

import asyncio
import json
from datetime import date
from typing import Any, AsyncIterator, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status, File, UploadFile, Form
from sse_starlette.sse import EventSourceResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Project, MeetingRecap, MeetingItem
from app.models.meeting_recap import InputType, MeetingStatus
from sqlalchemy import func
from app.schemas import (
    UploadResponse,
    MeetingResponse,
    MeetingItemResponse,
    MeetingItemCreate,
    MeetingItemReorderRequest,
    ApplyResponse,
    ConflictResultResponse,
    MatchedRequirementResponse,
)
from app.services import parse_file, extract_stream, ExtractionError, detect_conflicts, ConflictDetectionError

router = APIRouter(prefix="/api/meetings", tags=["meetings"])


@router.post("/upload", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_meeting(
    project_id: str = Form(...),
    title: str = Form(...),
    meeting_date: date = Form(...),
    file: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """
    Upload meeting notes for processing.

    Either file or text must be provided. If file is provided, it will be parsed.
    If text is provided, it will be used directly.
    """
    # Validate project exists
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    # Validate that either file or text is provided
    if file is None and text is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either file or text must be provided",
        )

    # Get content from file or text
    if file is not None:
        content = await parse_file(file)
        # Determine input type from file extension
        filename = file.filename or ""
        if filename.lower().endswith(".md"):
            input_type = InputType.md
        else:
            input_type = InputType.txt
    else:
        content = text or ""
        input_type = InputType.txt

    # Create meeting recap with status=pending
    meeting = MeetingRecap(
        project_id=project_id,
        title=title,
        meeting_date=meeting_date,
        raw_input=content,
        input_type=input_type,
        status=MeetingStatus.pending,
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)

    return {"job_id": meeting.id, "meeting_id": meeting.id}


@router.get("/{meeting_id}", response_model=MeetingResponse)
def get_meeting(meeting_id: str, db: Session = Depends(get_db)) -> dict:
    """
    Get a single meeting by ID with its items.

    Items filtered to exclude is_deleted=true.
    """
    meeting = db.query(MeetingRecap).filter(MeetingRecap.id == meeting_id).first()
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found",
        )

    # Get non-deleted items, ordered by section and order
    items = (
        db.query(MeetingItem)
        .filter(MeetingItem.meeting_id == meeting_id, MeetingItem.is_deleted == False)
        .order_by(MeetingItem.section, MeetingItem.order)
        .all()
    )

    # Build response with filtered items
    return {
        "id": meeting.id,
        "project_id": meeting.project_id,
        "title": meeting.title,
        "meeting_date": meeting.meeting_date,
        "raw_input": meeting.raw_input,
        "input_type": meeting.input_type,
        "status": meeting.status,
        "created_at": meeting.created_at,
        "processed_at": meeting.processed_at,
        "applied_at": meeting.applied_at,
        "failed_at": meeting.failed_at,
        "error_message": meeting.error_message,
        "prompt_version": meeting.prompt_version,
        "items": items,
    }


@router.delete("/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_meeting(meeting_id: str, db: Session = Depends(get_db)) -> None:
    """
    Delete a meeting and its associated items.

    Returns 204 No Content on success, 404 if meeting not found.
    """
    meeting = db.query(MeetingRecap).filter(MeetingRecap.id == meeting_id).first()
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found",
        )

    # Delete the meeting (cascade delete will remove associated items)
    db.delete(meeting)
    db.commit()


@router.post("/{meeting_id}/items", response_model=MeetingItemResponse, status_code=status.HTTP_201_CREATED)
def add_meeting_item(
    meeting_id: str,
    item_data: MeetingItemCreate,
    db: Session = Depends(get_db),
) -> MeetingItem:
    """
    Add a new item to a meeting.

    Sets order to max(order) + 1 for that section.
    Returns 404 if meeting not found.
    Returns 400 if meeting status is not processed.
    """
    # Find the meeting
    meeting = db.query(MeetingRecap).filter(MeetingRecap.id == meeting_id).first()
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found",
        )

    # Check meeting status
    if meeting.status != MeetingStatus.processed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot add items unless meeting status is processed",
        )

    # Get max order for this section (only non-deleted items)
    max_order = db.query(func.max(MeetingItem.order)).filter(
        MeetingItem.meeting_id == meeting_id,
        MeetingItem.section == item_data.section,
        MeetingItem.is_deleted == False,
    ).scalar()

    new_order = (max_order or 0) + 1

    # Create new item
    item = MeetingItem(
        meeting_id=meeting_id,
        section=item_data.section,
        content=item_data.content,
        order=new_order,
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    return item


@router.put("/{meeting_id}/items/reorder", response_model=list[MeetingItemResponse])
def reorder_meeting_items(
    meeting_id: str,
    reorder_data: MeetingItemReorderRequest,
    db: Session = Depends(get_db),
) -> list[MeetingItem]:
    """
    Reorder meeting items within a section.

    Updates the order field for each item based on the provided item_ids array.
    Returns 404 if meeting not found.
    Returns 400 if meeting status is not processed.
    """
    # Find the meeting
    meeting = db.query(MeetingRecap).filter(MeetingRecap.id == meeting_id).first()
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found",
        )

    # Check meeting status
    if meeting.status != MeetingStatus.processed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot reorder items unless meeting status is processed",
        )

    # Get all items for this section and meeting (non-deleted)
    items = (
        db.query(MeetingItem)
        .filter(
            MeetingItem.meeting_id == meeting_id,
            MeetingItem.section == reorder_data.section,
            MeetingItem.is_deleted == False,
        )
        .all()
    )

    # Create a lookup dict by ID
    items_by_id = {str(item.id): item for item in items}

    # Update order based on position in item_ids
    for new_order, item_id in enumerate(reorder_data.item_ids, start=1):
        if item_id in items_by_id:
            items_by_id[item_id].order = new_order  # type: ignore[assignment]

    db.commit()

    # Refresh and return all items in new order
    updated_items = (
        db.query(MeetingItem)
        .filter(
            MeetingItem.meeting_id == meeting_id,
            MeetingItem.section == reorder_data.section,
            MeetingItem.is_deleted == False,
        )
        .order_by(MeetingItem.order)
        .all()
    )

    return updated_items


@router.get("/{job_id}/stream")
async def stream_extraction(
    job_id: str,
    request: Request,
    db: Session = Depends(get_db),
) -> EventSourceResponse:
    """
    Stream extraction results as Server-Sent Events (SSE).

    Emits events:
    - {type: 'status', data: 'processing'} at start
    - {type: 'item', data: {section, content, source_quote}} for each item
    - {type: 'complete', data: {item_count}} when done
    - {type: 'error', data: {message}} on failure
    """
    # Verify meeting exists
    meeting = db.query(MeetingRecap).filter(MeetingRecap.id == job_id).first()
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found",
        )

    async def event_generator() -> AsyncIterator[dict[str, Any]]:
        """Generate SSE events for extraction streaming."""
        item_count = 0

        try:
            # Emit initial status event
            yield {
                "event": "status",
                "data": json.dumps("processing"),
            }

            # Stream items from extraction
            async for item in extract_stream(UUID(job_id), db):
                # Check if client disconnected
                if await request.is_disconnected():
                    break

                item_count += 1
                yield {
                    "event": "item",
                    "data": json.dumps({
                        "section": item["section"],
                        "content": item["content"],
                        "source_quote": item.get("source_quote"),
                    }),
                }

            # Emit complete event
            yield {
                "event": "complete",
                "data": json.dumps({"item_count": item_count}),
            }

        except ExtractionError as e:
            # Emit error event
            yield {
                "event": "error",
                "data": json.dumps({"message": str(e)}),
            }

        except Exception as e:
            # Emit error event for unexpected errors
            yield {
                "event": "error",
                "data": json.dumps({"message": f"Extraction failed: {e}"}),
            }

    return EventSourceResponse(event_generator())


@router.post("/{meeting_id}/apply", response_model=ApplyResponse)
def apply_meeting(
    meeting_id: str,
    db: Session = Depends(get_db),
) -> ApplyResponse:
    """
    Apply meeting items with conflict detection.

    Calls conflict detection service and returns categorized results:
    - added: Items that will be added as new requirements
    - skipped: Items that were skipped (duplicates)
    - conflicts: Items that need user resolution

    Does NOT create requirements yet (that happens in resolve endpoint).
    Returns 400 if meeting status is not processed.
    Returns 404 if meeting not found.
    """
    # Verify meeting exists
    meeting = db.query(MeetingRecap).filter(MeetingRecap.id == meeting_id).first()
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found",
        )

    # Check meeting status
    if meeting.status != MeetingStatus.processed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot apply meeting unless status is processed",
        )

    try:
        # Call conflict detection service
        result = detect_conflicts(UUID(meeting_id), db)

        # Convert dataclass results to Pydantic response models
        def convert_result(conflict_result: Any) -> ConflictResultResponse:
            matched_req = None
            if conflict_result.matched_requirement is not None:
                matched_req = MatchedRequirementResponse(
                    id=conflict_result.matched_requirement.id,
                    section=conflict_result.matched_requirement.section,
                    content=conflict_result.matched_requirement.content,
                )

            return ConflictResultResponse(
                item_id=conflict_result.item.id,
                item_section=conflict_result.item.section,
                item_content=conflict_result.item.content,
                decision=conflict_result.decision,
                reason=conflict_result.reason,
                matched_requirement=matched_req,
                classification=conflict_result.classification,
            )

        return ApplyResponse(
            added=[convert_result(r) for r in result.added],
            skipped=[convert_result(r) for r in result.skipped],
            conflicts=[convert_result(r) for r in result.conflicts],
        )

    except ConflictDetectionError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
