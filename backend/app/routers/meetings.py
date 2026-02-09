"""Meeting API endpoints."""

import json
from collections.abc import AsyncIterator
from datetime import date, datetime
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from sqlalchemy import func
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse

from app.activity import log_activity_safe
from app.auth import get_current_user, get_current_user_from_query
from app.database import get_db
from app.models import (
    Action,
    Actor,
    Decision,
    MeetingItem,
    MeetingItemDecision,
    MeetingRecap,
    Project,
    Requirement,
    RequirementHistory,
    RequirementSource,
)
from app.models.meeting_recap import InputType, MeetingStatus
from app.models.user import User
from app.schemas import (
    ApplyResponse,
    ConflictResultResponse,
    MatchedRequirementResponse,
    MeetingItemCreate,
    MeetingItemResponse,
    MeetingResponse,
    ResolveRequest,
    ResolveResponse,
    UploadResponse,
)
from app.services import (
    ConflictDetectionError,
    ExtractionError,
    detect_conflicts,
    extract_stream,
    parse_file,
    update_requirements_status,
)

router = APIRouter(prefix="/api/meetings", tags=["meetings"])


@router.post("/upload", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_meeting(
    request: Request,
    title: str = Form(...),
    meeting_date: date = Form(...),
    file: Optional[UploadFile] = File(default=None),
    text: Optional[str] = Form(default=None),
    project_id: Optional[str] = Form(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    """
    Upload meeting notes for processing.

    Either file or text must be provided. If file is provided, it will be parsed.
    If text is provided, it will be used directly.

    project_id is optional - if not provided, the meeting can be associated with a
    project later using the PATCH /{meeting_id}/project endpoint.
    """
    # Validate project exists if provided
    if project_id:
        project = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
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
        user_id=current_user.id,
        title=title,
        meeting_date=meeting_date,
        raw_input=content,
        input_type=input_type,
        status=MeetingStatus.pending,
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    log_activity_safe(db, current_user.id, "meeting.uploaded", "meeting", str(meeting.id), {"filename": file.filename if file else "text_input"}, request)

    return {"job_id": meeting.id, "meeting_id": meeting.id}


@router.patch("/{meeting_id}/project")
def associate_meeting_with_project(
    meeting_id: str,
    project_id: str = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    """
    Associate a meeting with a project.

    Used in the unified flow where meetings are created without a project context
    and the project is selected later (e.g., dashboard -> add meeting -> extract -> pick project).
    """
    # Validate meeting exists
    meeting = db.query(MeetingRecap).filter(MeetingRecap.id == meeting_id, MeetingRecap.user_id == current_user.id).first()
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found",
        )

    # Validate project exists
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    # Check if meeting already has a project
    if meeting.project_id and meeting.project_id != project_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Meeting is already associated with a different project",
        )

    # Associate meeting with project
    meeting.project_id = project_id
    db.commit()
    db.refresh(meeting)

    return {"meeting_id": meeting.id, "project_id": project_id}


@router.post("/{meeting_id}/retry", response_model=MeetingResponse)
def retry_meeting(meeting_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> dict:
    """
    Retry a failed extraction by resetting the meeting status.

    Resets the meeting status to 'pending' and clears the error_message.
    Returns 404 if meeting not found.
    Returns 400 if meeting status is not 'failed'.
    """
    meeting = db.query(MeetingRecap).filter(MeetingRecap.id == meeting_id, MeetingRecap.user_id == current_user.id).first()
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found",
        )

    # Check that meeting status is failed
    if meeting.status != MeetingStatus.failed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only retry meetings with failed status",
        )

    # Reset status to pending and clear error
    meeting.status = MeetingStatus.pending  # type: ignore[assignment]
    meeting.error_message = None  # type: ignore[assignment]
    meeting.failed_at = None  # type: ignore[assignment]

    db.commit()
    db.refresh(meeting)

    # Get non-deleted items for the response
    items = (
        db.query(MeetingItem)
        .filter(MeetingItem.meeting_id == meeting_id, MeetingItem.is_deleted == False)
        .order_by(MeetingItem.section, MeetingItem.order)
        .all()
    )

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


@router.get("/{meeting_id}", response_model=MeetingResponse)
def get_meeting(meeting_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> dict:
    """
    Get a single meeting by ID with its items.

    Items filtered to exclude is_deleted=true.
    """
    meeting = db.query(MeetingRecap).filter(MeetingRecap.id == meeting_id, MeetingRecap.user_id == current_user.id).first()
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
def delete_meeting(meeting_id: str, request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> None:
    """
    Delete a meeting and its associated items.

    Returns 204 No Content on success, 404 if meeting not found.
    """
    meeting = db.query(MeetingRecap).filter(MeetingRecap.id == meeting_id, MeetingRecap.user_id == current_user.id).first()
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found",
        )

    meeting_filename = meeting.title
    # Delete the meeting (cascade delete will remove associated items)
    db.delete(meeting)
    db.commit()
    log_activity_safe(db, current_user.id, "meeting.deleted", "meeting", meeting_id, {"filename": meeting_filename}, request)


@router.post("/{meeting_id}/items", response_model=MeetingItemResponse, status_code=status.HTTP_201_CREATED)
def add_meeting_item(
    meeting_id: str,
    item_data: MeetingItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MeetingItem:
    """
    Add a new item to a meeting.

    Sets order to max(order) + 1 for that section.
    Returns 404 if meeting not found.
    Returns 400 if meeting status is not processed.
    """
    # Find the meeting
    meeting = db.query(MeetingRecap).filter(MeetingRecap.id == meeting_id, MeetingRecap.user_id == current_user.id).first()
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


@router.get("/{job_id}/stream")
async def stream_extraction(
    job_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_query),
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
    meeting = db.query(MeetingRecap).filter(MeetingRecap.id == job_id, MeetingRecap.user_id == current_user.id).first()
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
                        "speaker": item.get("speaker"),
                        "priority": item.get("priority"),
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
    current_user: User = Depends(get_current_user),
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
    meeting = db.query(MeetingRecap).filter(MeetingRecap.id == meeting_id, MeetingRecap.user_id == current_user.id).first()
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

    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"[DEBUG Apply] Meeting {meeting_id}: project_id={meeting.project_id}")

    try:
        # Call conflict detection service
        result = detect_conflicts(UUID(meeting_id), db)
        logger.info(f"[DEBUG Apply] Results: added={len(result.added)}, skipped={len(result.skipped)}, conflicts={len(result.conflicts)}")

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


@router.post("/{meeting_id}/resolve", response_model=ResolveResponse)
def resolve_meeting(
    meeting_id: str,
    request: ResolveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ResolveResponse:
    """
    Resolve conflicts and create requirements from meeting items.

    Accepts an array of decisions, each containing:
    - item_id: The meeting item ID
    - decision: The decision type (added, skipped_*, conflict_*)
    - merged_text: Required for conflict_merged decisions
    - matched_requirement_id: Required for conflict decisions

    This endpoint:
    1. Creates requirements for added items with is_active=true
    2. Records all decisions in MeetingItemDecision table
    3. Updates RequirementHistory for all changes with actor=ai_extraction or ai_merge
    4. Creates RequirementSource entries linking requirement to meeting and meeting_item
    5. Updates meeting status to applied and sets applied_at timestamp

    Returns counts: {added, skipped, merged, replaced}
    Returns 400 if meeting status is not processed.
    Returns 404 if meeting not found.
    """
    # Verify meeting exists
    meeting = db.query(MeetingRecap).filter(MeetingRecap.id == meeting_id, MeetingRecap.user_id == current_user.id).first()
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found",
        )

    # Check meeting status
    if meeting.status != MeetingStatus.processed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot resolve meeting unless status is processed",
        )

    # Get project_id from meeting
    project_id = meeting.project_id

    # Initialize counters
    counts = ResolveResponse()

    # Build a lookup for meeting items
    meeting_items = (
        db.query(MeetingItem)
        .filter(MeetingItem.meeting_id == meeting_id)
        .filter(MeetingItem.is_deleted == False)
        .all()
    )
    items_by_id = {item.id: item for item in meeting_items}

    # Get max order per section for new requirements
    max_orders: dict[str, int] = {}
    existing_max_orders = (
        db.query(Requirement.section, func.max(Requirement.order))
        .filter(Requirement.project_id == project_id)
        .filter(Requirement.is_active == True)
        .group_by(Requirement.section)
        .all()
    )
    for section, max_order in existing_max_orders:
        max_orders[section.value if hasattr(section, 'value') else section] = max_order or 0

    # Process each decision
    for decision_data in request.decisions:
        item = items_by_id.get(decision_data.item_id)
        if not item:
            # Skip if item not found
            continue

        decision_type = decision_data.decision
        matched_req_id = decision_data.matched_requirement_id
        merged_text = decision_data.merged_text

        # Determine the Decision enum value
        try:
            decision_enum = Decision(decision_type)
        except ValueError:
            # Skip invalid decision types
            continue

        # Handle based on decision type
        if decision_type == "added":
            # Create new requirement
            section_key = item.section.value if hasattr(item.section, 'value') else str(item.section)
            new_order = max_orders.get(section_key, 0) + 1
            max_orders[section_key] = new_order

            requirement = Requirement(
                project_id=project_id,
                section=item.section,
                content=item.content,
                order=new_order,
                is_active=True,
            )
            db.add(requirement)
            db.flush()  # Get the requirement ID

            # Create RequirementSource
            source = RequirementSource(
                requirement_id=requirement.id,
                meeting_id=meeting_id,
                meeting_item_id=item.id,
                source_quote=item.source_quote,
            )
            db.add(source)

            # Create RequirementHistory
            history = RequirementHistory(
                requirement_id=requirement.id,
                meeting_id=meeting_id,
                actor=Actor.ai_extraction,
                action=Action.created,
                old_content=None,
                new_content=item.content,
            )
            db.add(history)

            # Record decision
            decision_record = MeetingItemDecision(
                meeting_item_id=item.id,
                decision=decision_enum,
                matched_requirement_id=None,
                reason="New requirement added",
            )
            db.add(decision_record)

            counts.added += 1

        elif decision_type in ("skipped_duplicate", "skipped_semantic"):
            # Just record the decision, no requirement changes
            decision_record = MeetingItemDecision(
                meeting_item_id=item.id,
                decision=decision_enum,
                matched_requirement_id=matched_req_id,
                reason="Skipped as duplicate" if decision_type == "skipped_duplicate" else "Skipped as semantic duplicate",
            )
            db.add(decision_record)

            counts.skipped += 1

        elif decision_type == "conflict_keep_existing":
            # Just record the decision, keep existing requirement unchanged
            decision_record = MeetingItemDecision(
                meeting_item_id=item.id,
                decision=decision_enum,
                matched_requirement_id=matched_req_id,
                reason="Kept existing requirement",
            )
            db.add(decision_record)

            counts.skipped += 1

        elif decision_type == "conflict_replaced":
            # Replace existing requirement with new content
            if matched_req_id:
                matched_req = db.query(Requirement).filter(Requirement.id == matched_req_id).first()
                if matched_req:
                    old_content = matched_req.content
                    matched_req.content = item.content  # type: ignore[assignment]

                    # Create RequirementSource
                    source = RequirementSource(
                        requirement_id=matched_req.id,
                        meeting_id=meeting_id,
                        meeting_item_id=item.id,
                        source_quote=item.source_quote,
                    )
                    db.add(source)

                    # Create RequirementHistory
                    history = RequirementHistory(
                        requirement_id=matched_req.id,
                        meeting_id=meeting_id,
                        actor=Actor.ai_extraction,
                        action=Action.modified,
                        old_content=old_content,
                        new_content=item.content,
                    )
                    db.add(history)

            # Record decision
            decision_record = MeetingItemDecision(
                meeting_item_id=item.id,
                decision=decision_enum,
                matched_requirement_id=matched_req_id,
                reason="Replaced existing requirement",
            )
            db.add(decision_record)

            counts.replaced += 1

        elif decision_type == "conflict_kept_both":
            # Create a new requirement alongside the existing one
            section_key = item.section.value if hasattr(item.section, 'value') else str(item.section)
            new_order = max_orders.get(section_key, 0) + 1
            max_orders[section_key] = new_order

            requirement = Requirement(
                project_id=project_id,
                section=item.section,
                content=item.content,
                order=new_order,
                is_active=True,
            )
            db.add(requirement)
            db.flush()

            # Create RequirementSource
            source = RequirementSource(
                requirement_id=requirement.id,
                meeting_id=meeting_id,
                meeting_item_id=item.id,
                source_quote=item.source_quote,
            )
            db.add(source)

            # Create RequirementHistory
            history = RequirementHistory(
                requirement_id=requirement.id,
                meeting_id=meeting_id,
                actor=Actor.ai_extraction,
                action=Action.created,
                old_content=None,
                new_content=item.content,
            )
            db.add(history)

            # Record decision
            decision_record = MeetingItemDecision(
                meeting_item_id=item.id,
                decision=decision_enum,
                matched_requirement_id=matched_req_id,
                reason="Kept both existing and new requirement",
            )
            db.add(decision_record)

            counts.added += 1

        elif decision_type == "conflict_merged":
            # Merge with existing requirement using merged_text
            if matched_req_id and merged_text:
                matched_req = db.query(Requirement).filter(Requirement.id == matched_req_id).first()
                if matched_req:
                    old_content = matched_req.content
                    matched_req.content = merged_text  # type: ignore[assignment]

                    # Create RequirementSource
                    source = RequirementSource(
                        requirement_id=matched_req.id,
                        meeting_id=meeting_id,
                        meeting_item_id=item.id,
                        source_quote=item.source_quote,
                    )
                    db.add(source)

                    # Create RequirementHistory with ai_merge actor
                    history = RequirementHistory(
                        requirement_id=matched_req.id,
                        meeting_id=meeting_id,
                        actor=Actor.ai_merge,
                        action=Action.merged,
                        old_content=old_content,
                        new_content=merged_text,
                    )
                    db.add(history)

            # Record decision
            decision_record = MeetingItemDecision(
                meeting_item_id=item.id,
                decision=decision_enum,
                matched_requirement_id=matched_req_id,
                reason="Merged with existing requirement",
            )
            db.add(decision_record)

            counts.merged += 1

    # Update meeting status to applied
    meeting.status = MeetingStatus.applied  # type: ignore[assignment]
    meeting.applied_at = datetime.utcnow()  # type: ignore[assignment]

    # Commit all changes
    db.commit()

    # Auto-update requirements stage status based on new requirements count
    update_requirements_status(project_id, db)

    return counts
