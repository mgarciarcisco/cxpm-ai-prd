"""Bug report API endpoints: submit, list, view, update status, and serve screenshots."""

import mimetypes
import os
import uuid as uuid_mod
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_admin
from app.config import settings
from app.database import get_db
from app.models.bug_report import BugReport, BugSeverity, BugStatus
from app.models.notification import NotificationType
from app.models.user import User
from app.notifications import create_notification_safe
from app.schemas.bug_report import BugReportListResponse, BugReportResponse, BugStatusUpdate

router = APIRouter(prefix="/api/bug-reports", tags=["bug-reports"])

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}
MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024  # 5 MB

# Magic byte signatures for image file validation
MAGIC_BYTES = {
    b'\x89PNG': 'png',
    b'\xff\xd8\xff': 'jpg',
    b'GIF87a': 'gif',
    b'GIF89a': 'gif',
    b'RIFF': 'webp',  # WebP starts with RIFF
}


def _validate_magic_bytes(content: bytes) -> bool:
    """Check file content starts with valid image magic bytes."""
    for magic in MAGIC_BYTES:
        if content[:len(magic)] == magic:
            return True
    return False


def _bug_to_response(bug: BugReport, reporter_name: str | None = None) -> BugReportResponse:
    """Build a BugReportResponse from a BugReport ORM model."""
    return BugReportResponse(
        id=bug.id,
        title=bug.title,
        description=bug.description,
        severity=bug.severity,
        status=bug.status,
        steps_to_reproduce=bug.steps_to_reproduce,
        has_screenshot=bug.screenshot_path is not None,
        page_url=bug.page_url,
        browser_info=bug.browser_info,
        reporter_id=bug.reporter_id,
        reporter_name=reporter_name,
        created_at=bug.created_at,
        updated_at=bug.updated_at,
    )


# ---------------------------------------------------------------------------
# POST /api/bug-reports  -  Submit a new bug report (multipart/form-data)
# ---------------------------------------------------------------------------
@router.post("", status_code=status.HTTP_201_CREATED, response_model=BugReportResponse)
async def submit_bug_report(
    title: str = Form(..., min_length=1, max_length=255),
    description: str = Form(..., min_length=1, max_length=10000),
    severity: str = Form("minor"),
    steps_to_reproduce: Optional[str] = Form(None, max_length=10000),
    page_url: Optional[str] = Form(None, max_length=500),
    browser_info: Optional[str] = Form(None, max_length=500),
    screenshot: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BugReportResponse:
    """Submit a new bug report with an optional screenshot upload."""

    # Validate severity value
    try:
        bug_severity = BugSeverity(severity)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid severity '{severity}'. Must be one of: {', '.join(s.value for s in BugSeverity)}",
        )

    screenshot_path: str | None = None

    # Handle screenshot upload
    if screenshot and screenshot.filename:
        # Validate file extension
        ext = screenshot.filename.rsplit(".", 1)[-1].lower() if "." in screenshot.filename else ""
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid file type '.{ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
            )

        # Read file content with streaming size check
        chunks = []
        total_size = 0
        while True:
            chunk = await screenshot.read(8192)
            if not chunk:
                break
            total_size += len(chunk)
            if total_size > MAX_SCREENSHOT_BYTES:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Screenshot exceeds maximum size of 5 MB.",
                )
            chunks.append(chunk)
        file_content = b"".join(chunks)

        # Validate magic bytes to ensure the file is actually an image
        if not _validate_magic_bytes(file_content):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File content does not match a valid image format.",
            )

        # Save to disk with a UUID filename
        screenshots_dir = Path(settings.UPLOAD_DIR) / "screenshots"
        screenshots_dir.mkdir(parents=True, exist_ok=True)

        filename = f"{uuid_mod.uuid4()}.{ext}"
        file_path = screenshots_dir / filename
        file_path.write_bytes(file_content)

        # Store relative path from UPLOAD_DIR
        screenshot_path = f"screenshots/{filename}"

    # Create the bug report record
    bug = BugReport(
        title=title,
        description=description,
        severity=bug_severity,
        steps_to_reproduce=steps_to_reproduce,
        screenshot_path=screenshot_path,
        page_url=page_url,
        browser_info=browser_info,
        reporter_id=current_user.id,
    )
    db.add(bug)
    db.commit()
    db.refresh(bug)

    return _bug_to_response(bug, reporter_name=current_user.name)


# ---------------------------------------------------------------------------
# GET /api/bug-reports/mine  -  List current user's bug reports (paginated)
# NOTE: This route MUST be registered BEFORE /{id} to avoid path conflicts.
# ---------------------------------------------------------------------------
@router.get("/mine", response_model=BugReportListResponse)
def list_my_bugs(
    page: int = Query(default=1, ge=1, le=100),
    per_page: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BugReportListResponse:
    """Return the current user's own bug reports, newest first."""
    query = db.query(BugReport).filter(BugReport.reporter_id == current_user.id)

    total = query.count()
    bugs = (
        query.order_by(BugReport.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return BugReportListResponse(
        items=[_bug_to_response(b, reporter_name=current_user.name) for b in bugs],
        total=total,
        page=page,
        per_page=per_page,
    )


# ---------------------------------------------------------------------------
# GET /api/bug-reports  -  Admin only: list all bug reports (paginated + filters)
# NOTE: This route MUST be registered BEFORE /{id} to avoid path conflicts.
# ---------------------------------------------------------------------------
@router.get("", response_model=BugReportListResponse)
def list_all_bugs(
    page: int = Query(default=1, ge=1, le=100),
    per_page: int = Query(default=20, ge=1, le=100),
    status_filter: Optional[str] = None,
    severity: Optional[str] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> BugReportListResponse:
    """Admin endpoint: list all bug reports with optional status/severity filters."""
    query = db.query(BugReport)

    if status_filter:
        try:
            bug_status = BugStatus(status_filter)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status '{status_filter}'. Must be one of: {', '.join(s.value for s in BugStatus)}",
            )
        query = query.filter(BugReport.status == bug_status)

    if severity:
        try:
            bug_severity = BugSeverity(severity)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid severity '{severity}'. Must be one of: {', '.join(s.value for s in BugSeverity)}",
            )
        query = query.filter(BugReport.severity == bug_severity)

    total = query.count()

    bugs = (
        query.order_by(BugReport.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    # Collect reporter IDs and batch-fetch names
    reporter_ids = {b.reporter_id for b in bugs}
    reporters = {u.id: u.name for u in db.query(User).filter(User.id.in_(reporter_ids)).all()} if reporter_ids else {}

    return BugReportListResponse(
        items=[_bug_to_response(b, reporter_name=reporters.get(b.reporter_id)) for b in bugs],
        total=total,
        page=page,
        per_page=per_page,
    )


# ---------------------------------------------------------------------------
# GET /api/bug-reports/stats  -  Admin only: bug report counts by status
# NOTE: This route MUST be registered BEFORE /{id} to avoid path conflicts.
# ---------------------------------------------------------------------------
@router.get("/stats")
def get_bug_stats(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin endpoint: get bug report counts by status."""
    rows = (
        db.query(BugReport.status, func.count(BugReport.id))
        .group_by(BugReport.status)
        .all()
    )
    stats = {s.value: 0 for s in BugStatus}
    for status_val, count in rows:
        key = status_val.value if hasattr(status_val, 'value') else status_val
        stats[key] = count
    return stats


# ---------------------------------------------------------------------------
# GET /api/bug-reports/{id}  -  View a single bug report (reporter or admin)
# ---------------------------------------------------------------------------
@router.get("/{id}", response_model=BugReportResponse)
def get_bug_report(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BugReportResponse:
    """View a single bug report. Only the reporter or an admin may access it."""
    bug = db.query(BugReport).filter(BugReport.id == id).first()
    if not bug:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bug report not found")

    if bug.reporter_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Fetch reporter name
    reporter = db.query(User).filter(User.id == bug.reporter_id).first()
    reporter_name = reporter.name if reporter else None

    return _bug_to_response(bug, reporter_name=reporter_name)


# ---------------------------------------------------------------------------
# PATCH /api/bug-reports/{id}/status  -  Admin only: update bug status
# ---------------------------------------------------------------------------
@router.patch("/{id}/status", response_model=BugReportResponse)
def update_bug_status(
    id: str,
    payload: BugStatusUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> BugReportResponse:
    """Admin endpoint: update the status of a bug report and notify the reporter."""
    bug = db.query(BugReport).filter(BugReport.id == id).first()
    if not bug:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bug report not found")

    bug.status = BugStatus(payload.status.value)
    db.commit()
    db.refresh(bug)

    # Notify the reporter about the status change
    create_notification_safe(
        db=db,
        user_id=bug.reporter_id,
        notification_type=NotificationType.bug_status_change,
        title="Bug Report Updated",
        message=f"Your bug '{bug.title}' is now '{payload.status.value}'",
        resource_type="bug_report",
        resource_id=bug.id,
    )

    # Fetch reporter name for response
    reporter = db.query(User).filter(User.id == bug.reporter_id).first()
    reporter_name = reporter.name if reporter else None

    return _bug_to_response(bug, reporter_name=reporter_name)


# ---------------------------------------------------------------------------
# GET /api/bug-reports/{id}/screenshot  -  Serve screenshot file (reporter or admin)
# ---------------------------------------------------------------------------
@router.get("/{id}/screenshot")
def get_bug_screenshot(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FileResponse:
    """Serve the screenshot file for a bug report. Only the reporter or an admin may access it."""
    bug = db.query(BugReport).filter(BugReport.id == id).first()
    if not bug:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bug report not found")

    if bug.reporter_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    if not bug.screenshot_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No screenshot attached")

    # Reconstruct full path from relative screenshot_path
    full_path = os.path.join(settings.UPLOAD_DIR, bug.screenshot_path)

    if not os.path.isfile(full_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Screenshot file not found")

    media_type = mimetypes.guess_type(bug.screenshot_path)[0] or "application/octet-stream"
    return FileResponse(
        full_path,
        media_type=media_type,
        headers={"X-Content-Type-Options": "nosniff"},
    )
