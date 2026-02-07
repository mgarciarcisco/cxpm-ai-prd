"""Admin API endpoints: user management, activity logs, and dashboard stats."""

import csv
import io
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.activity import log_activity_safe
from app.auth import (
    generate_random_password,
    hash_password,
    require_admin,
)
from app.database import get_db
from app.models.activity_log import ActivityLog
from app.models.prd import PRD
from app.models.meeting_recap import MeetingRecap
from app.models.project import Project
from app.models.user import User
from app.schemas.admin import (
    ActivityLogListResponse,
    ActivityLogResponse,
    AdminUserListResponse,
    AdminUserResponse,
    BulkOperationResponse,
    BulkUserRequest,
    ContentStats,
    DashboardStatsResponse,
    EngagementStats,
    ExportStats,
    PasswordResetResponse,
    UserStats,
    WeeklyChangeStats,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ── User Management ──────────────────────────────────────────────────────────


@router.get("/users", response_model=AdminUserListResponse)
def list_users(
    status_filter: str | None = Query(None, alias="status"),
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminUserListResponse:
    """List all users with optional filtering."""
    query = db.query(User).filter(User.email != "system@localhost")

    # Apply status filter
    if status_filter == "pending":
        query = query.filter(User.is_active == True, User.is_approved == False)  # noqa: E712
    elif status_filter == "active":
        query = query.filter(User.is_active == True, User.is_approved == True)  # noqa: E712
    elif status_filter == "deactivated":
        query = query.filter(User.is_active == False)  # noqa: E712

    # Apply search
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(User.name.ilike(search_term), User.email.ilike(search_term))
        )

    total = query.count()
    users = query.order_by(User.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()

    return AdminUserListResponse(
        users=[AdminUserResponse.model_validate(u) for u in users],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/users/{user_id}", response_model=AdminUserResponse)
def get_user(
    user_id: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminUserResponse:
    """Get a single user's details."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return AdminUserResponse.model_validate(user)


@router.post("/users/{user_id}/approve")
def approve_user(
    user_id: str,
    request: Request,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Approve a pending user."""
    user = db.query(User).filter(User.id == user_id).with_for_update().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.is_approved:
        return {"message": "User already approved", "already_done": True}

    user.is_approved = True
    user.approved_by = current_user.id
    user.approved_at = datetime.now(timezone.utc)
    db.commit()

    log_activity_safe(
        db, current_user.id, "admin.user_approved", "user", user_id,
        {"target_email": user.email}, request,
    )
    return {"message": f"{user.name} has been approved"}


@router.post("/users/{user_id}/reject")
def reject_user(
    user_id: str,
    request: Request,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Reject a pending user."""
    user = db.query(User).filter(User.id == user_id).with_for_update().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = False
    user.is_approved = False
    user.token_invalid_before = datetime.now(timezone.utc)
    db.commit()

    log_activity_safe(
        db, current_user.id, "admin.user_rejected", "user", user_id,
        {"target_email": user.email}, request,
    )
    return {"message": f"{user.name} has been rejected"}


@router.post("/users/{user_id}/deactivate")
def deactivate_user(
    user_id: str,
    request: Request,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Deactivate a user. Cannot deactivate self."""
    if user_id == str(current_user.id):
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = False
    user.deactivated_at = datetime.now(timezone.utc)
    user.deactivated_by = current_user.id
    user.token_invalid_before = datetime.now(timezone.utc)
    db.commit()

    log_activity_safe(
        db, current_user.id, "admin.user_deactivated", "user", user_id,
        {"target_email": user.email}, request,
    )
    return {"message": f"{user.name} has been deactivated"}


@router.post("/users/{user_id}/reactivate")
def reactivate_user(
    user_id: str,
    request: Request,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Reactivate a deactivated user."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = True
    user.is_approved = True
    user.deactivated_at = None
    user.deactivated_by = None
    db.commit()

    log_activity_safe(
        db, current_user.id, "admin.user_reactivated", "user", user_id,
        {"target_email": user.email}, request,
    )
    return {"message": f"{user.name} has been reactivated"}


@router.post("/users/{user_id}/make-admin")
def make_admin(
    user_id: str,
    request: Request,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Promote a user to admin."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.is_admin:
        return {"message": "User is already an admin", "already_done": True}

    user.is_admin = True
    db.commit()

    log_activity_safe(
        db, current_user.id, "admin.user_promoted", "user", user_id,
        {"target_email": user.email}, request,
    )
    return {"message": f"{user.name} has been promoted to admin"}


@router.post("/users/{user_id}/remove-admin")
def remove_admin(
    user_id: str,
    request: Request,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Remove admin role. Cannot remove last admin."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Self-protection: check if this is the last admin
    if user_id == str(current_user.id) or user.id == current_user.id:
        admin_count = db.query(User).filter(
            User.is_admin == True, User.is_active == True  # noqa: E712
        ).count()
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot remove the last admin")

    user.is_admin = False
    db.commit()

    log_activity_safe(
        db, current_user.id, "admin.user_demoted", "user", user_id,
        {"target_email": user.email}, request,
    )
    return {"message": f"{user.name} has been removed from admin"}


@router.post("/users/{user_id}/reset-password", response_model=PasswordResetResponse)
def reset_password(
    user_id: str,
    request: Request,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> PasswordResetResponse:
    """Generate a temporary password for a user."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    temp_password = generate_random_password()
    user.hashed_password = hash_password(temp_password)
    user.token_invalid_before = datetime.now(timezone.utc)
    db.commit()

    log_activity_safe(
        db, current_user.id, "admin.password_reset", "user", user_id,
        {"target_email": user.email}, request,
    )
    return PasswordResetResponse(temporary_password=temp_password)


@router.post("/users/{user_id}/unlock")
def unlock_user(
    user_id: str,
    request: Request,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Unlock a locked account."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.locked_until = None
    user.failed_login_attempts = 0
    db.commit()

    log_activity_safe(
        db, current_user.id, "admin.user_unlocked", "user", user_id,
        {"target_email": user.email}, request,
    )
    return {"message": f"{user.name} has been unlocked"}


# ── Bulk Operations ──────────────────────────────────────────────────────────


@router.post("/users/bulk-approve", response_model=BulkOperationResponse)
def bulk_approve(
    payload: BulkUserRequest,
    request: Request,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> BulkOperationResponse:
    """Approve multiple pending users."""
    success_count = 0
    errors = []

    for uid in payload.user_ids:
        try:
            user = db.query(User).filter(User.id == uid).first()
            if not user:
                errors.append(f"User {uid} not found")
                continue
            if user.is_approved:
                success_count += 1  # Already done, count as success
                continue

            user.is_approved = True
            user.approved_by = current_user.id
            user.approved_at = datetime.now(timezone.utc)
            db.commit()
            success_count += 1

            log_activity_safe(
                db, current_user.id, "admin.user_approved", "user", uid,
                {"target_email": user.email, "bulk": True}, request,
            )
        except Exception as e:
            db.rollback()
            errors.append(f"Failed to approve {uid}: {str(e)}")

    return BulkOperationResponse(
        success_count=success_count,
        failed_count=len(errors),
        errors=errors,
    )


@router.post("/users/bulk-reject", response_model=BulkOperationResponse)
def bulk_reject(
    payload: BulkUserRequest,
    request: Request,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> BulkOperationResponse:
    """Reject multiple pending users."""
    success_count = 0
    errors = []

    for uid in payload.user_ids:
        try:
            user = db.query(User).filter(User.id == uid).first()
            if not user:
                errors.append(f"User {uid} not found")
                continue

            user.is_active = False
            user.is_approved = False
            user.token_invalid_before = datetime.now(timezone.utc)
            db.commit()
            success_count += 1

            log_activity_safe(
                db, current_user.id, "admin.user_rejected", "user", uid,
                {"target_email": user.email, "bulk": True}, request,
            )
        except Exception as e:
            db.rollback()
            errors.append(f"Failed to reject {uid}: {str(e)}")

    return BulkOperationResponse(
        success_count=success_count,
        failed_count=len(errors),
        errors=errors,
    )


# ── Activity Log ─────────────────────────────────────────────────────────────


@router.get("/activity", response_model=ActivityLogListResponse)
def list_activity(
    user_id: str | None = Query(None),
    action: str | None = Query(None),
    from_date: str | None = Query(None),
    to_date: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> ActivityLogListResponse:
    """List activity logs with optional filters."""
    query = db.query(ActivityLog)

    if user_id:
        query = query.filter(ActivityLog.user_id == user_id)
    if action:
        # Prefix match: "prd." matches "prd.generation_started", etc.
        query = query.filter(ActivityLog.action.like(f"{action}%"))
    if from_date:
        try:
            from_dt = datetime.fromisoformat(from_date.replace("Z", "+00:00"))
            query = query.filter(ActivityLog.created_at >= from_dt)
        except ValueError:
            pass
    if to_date:
        try:
            to_dt = datetime.fromisoformat(to_date.replace("Z", "+00:00"))
            query = query.filter(ActivityLog.created_at <= to_dt)
        except ValueError:
            pass

    total = query.count()
    logs = query.order_by(ActivityLog.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()

    # Fetch user info for each log entry
    user_ids = {log.user_id for log in logs if log.user_id}
    users_map = {}
    if user_ids:
        users = db.query(User).filter(User.id.in_(user_ids)).all()
        users_map = {u.id: u for u in users}

    items = []
    for log in logs:
        u = users_map.get(log.user_id)
        items.append(ActivityLogResponse(
            id=log.id,
            user_id=log.user_id,
            user_email=u.email if u else None,
            user_name=u.name if u else None,
            action=log.action,
            resource_type=log.resource_type,
            resource_id=log.resource_id,
            metadata=log.metadata_,
            ip_address=log.ip_address,
            user_agent=log.user_agent,
            request_id=log.request_id,
            created_at=log.created_at,
        ))

    return ActivityLogListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/activity/export")
def export_activity(
    user_id: str | None = Query(None),
    action: str | None = Query(None),
    from_date: str | None = Query(None),
    to_date: str | None = Query(None),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Export activity logs as CSV."""
    query = db.query(ActivityLog)

    if user_id:
        query = query.filter(ActivityLog.user_id == user_id)
    if action:
        query = query.filter(ActivityLog.action.like(f"{action}%"))
    if from_date:
        try:
            from_dt = datetime.fromisoformat(from_date.replace("Z", "+00:00"))
            query = query.filter(ActivityLog.created_at >= from_dt)
        except ValueError:
            pass
    if to_date:
        try:
            to_dt = datetime.fromisoformat(to_date.replace("Z", "+00:00"))
            query = query.filter(ActivityLog.created_at <= to_dt)
        except ValueError:
            pass

    logs = query.order_by(ActivityLog.created_at.desc()).limit(10000).all()

    # Fetch user info
    user_ids = {log.user_id for log in logs if log.user_id}
    users_map = {}
    if user_ids:
        users = db.query(User).filter(User.id.in_(user_ids)).all()
        users_map = {u.id: u for u in users}

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Timestamp", "User Email", "User Name", "Action", "Resource Type", "Resource ID", "IP Address"])

    for log in logs:
        u = users_map.get(log.user_id)
        writer.writerow([
            log.created_at.isoformat() if log.created_at else "",
            u.email if u else "",
            u.name if u else "",
            log.action,
            log.resource_type or "",
            log.resource_id or "",
            log.ip_address or "",
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=activity_log.csv"},
    )


# ── Dashboard Stats ──────────────────────────────────────────────────────────

# Simple 1-minute cache
_stats_cache: dict = {"data": None, "cached_at": None}


@router.get("/stats", response_model=DashboardStatsResponse)
def get_stats(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> DashboardStatsResponse:
    """Get dashboard statistics. Cached for 1 minute."""
    now = datetime.now(timezone.utc)

    # Check cache
    if _stats_cache["data"] and _stats_cache["cached_at"]:
        cache_age = (now - _stats_cache["cached_at"]).total_seconds()
        if cache_age < 60:
            return _stats_cache["data"]

    # Compute stats
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)

    # User stats
    base_users = db.query(User).filter(User.email != "system@localhost")
    total_users = base_users.count()
    pending = base_users.filter(User.is_active == True, User.is_approved == False).count()  # noqa: E712
    active = base_users.filter(User.is_active == True, User.is_approved == True).count()  # noqa: E712
    deactivated = base_users.filter(User.is_active == False).count()  # noqa: E712
    active_today = base_users.filter(User.last_active_at >= today_start).count()
    active_this_week = base_users.filter(User.last_active_at >= week_start).count()

    # Content stats
    total_projects = db.query(Project).count()
    total_prds = db.query(PRD).count()
    total_stories = 0  # UserStory table removed
    total_meetings = db.query(MeetingRecap).count()

    # Engagement stats
    avg_projects = round(total_projects / max(active, 1), 1)
    prd_rate = round(total_prds / max(total_projects, 1), 2)
    story_rate = round(total_prds / max(total_projects, 1), 2) if total_prds > 0 else 0.0

    # Export counts from activity logs
    export_total = db.query(ActivityLog).filter(ActivityLog.action.like("export.%")).count()
    export_md = db.query(ActivityLog).filter(ActivityLog.action == "export.prd_markdown").count()
    export_confluence = db.query(ActivityLog).filter(ActivityLog.action == "export.prd_confluence").count()
    export_jira = db.query(ActivityLog).filter(ActivityLog.action == "export.stories_jira").count()

    # Weekly change
    new_users_week = base_users.filter(User.created_at >= week_start).count()
    new_projects_week = db.query(Project).filter(Project.created_at >= week_start).count()
    new_prds_week = db.query(PRD).filter(PRD.created_at >= week_start).count()
    new_stories_week = 0  # UserStory table removed
    new_meetings_week = db.query(MeetingRecap).filter(MeetingRecap.created_at >= week_start).count()

    result = DashboardStatsResponse(
        users=UserStats(
            total=total_users,
            pending=pending,
            active=active,
            deactivated=deactivated,
            active_today=active_today,
            active_this_week=active_this_week,
        ),
        content=ContentStats(
            total_projects=total_projects,
            total_prds=total_prds,
            total_stories=total_stories,
            total_meetings=total_meetings,
        ),
        engagement=EngagementStats(
            avg_projects_per_user=avg_projects,
            prd_completion_rate=prd_rate,
            story_generation_rate=story_rate,
            exports=ExportStats(
                total=export_total,
                markdown=export_md,
                confluence=export_confluence,
                jira=export_jira,
            ),
        ),
        weekly_change=WeeklyChangeStats(
            users=new_users_week,
            projects=new_projects_week,
            prds=new_prds_week,
            stories=new_stories_week,
            meetings=new_meetings_week,
        ),
        cached_at=now,
    )

    # Update cache
    _stats_cache["data"] = result
    _stats_cache["cached_at"] = now

    return result
