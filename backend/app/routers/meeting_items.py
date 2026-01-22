"""MeetingItem API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import MeetingItem, MeetingRecap
from app.models.meeting_recap import MeetingStatus
from app.schemas import MeetingItemResponse, MeetingItemUpdate

router = APIRouter(prefix="/api/meeting-items", tags=["meeting-items"])


@router.put("/{item_id}", response_model=MeetingItemResponse)
def update_meeting_item(
    item_id: str,
    update: MeetingItemUpdate,
    db: Session = Depends(get_db),
) -> MeetingItem:
    """
    Update a meeting item's content.

    Returns 404 if item not found.
    Returns 400 if meeting status is not processed.
    """
    # Find the item
    item = db.query(MeetingItem).filter(MeetingItem.id == item_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting item not found",
        )

    # Get the associated meeting and check its status
    meeting = db.query(MeetingRecap).filter(MeetingRecap.id == item.meeting_id).first()
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found",
        )

    if meeting.status != MeetingStatus.processed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot edit items unless meeting status is processed",
        )

    # Update the item content
    item.content = update.content  # type: ignore[assignment]
    db.commit()
    db.refresh(item)

    return item
