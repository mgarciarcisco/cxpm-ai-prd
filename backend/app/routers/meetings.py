"""Meeting API endpoints."""

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Project, MeetingRecap
from app.models.meeting_recap import InputType, MeetingStatus
from app.schemas import UploadResponse
from app.services import parse_file

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
