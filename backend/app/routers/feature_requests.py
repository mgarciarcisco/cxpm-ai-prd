"""Feature request API endpoints: CRUD, upvotes, comments, and admin actions."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_admin
from app.database import get_db
from app.models.feature_request import (
    FeatureCategory,
    FeatureRequest,
    FeatureRequestComment,
    FeatureRequestUpvote,
    FeatureStatus,
)
from app.models.notification import NotificationType
from app.models.user import User
from app.notifications import create_notification_safe
from app.schemas.feature_request import (
    CommentCreate,
    CommentResponse,
    CommentUpdate,
    FeatureRequestCreate,
    FeatureRequestListResponse,
    FeatureRequestResponse,
    FeatureRequestUpdate,
    FeatureStatusUpdate,
    UpvoteResponse,
)

router = APIRouter(prefix="/api/feature-requests", tags=["feature-requests"])


# ── Helpers ──────────────────────────────────────────────────────────────────


def _build_enriched_query(db: Session, current_user: User):
    """Build the base query with subqueries for upvote_count, comment_count,
    user_has_upvoted, and submitter_name.  Returns the query object."""
    upvote_counts = (
        db.query(
            FeatureRequestUpvote.feature_request_id,
            func.count(FeatureRequestUpvote.id).label("upvote_count"),
        )
        .group_by(FeatureRequestUpvote.feature_request_id)
        .subquery()
    )

    comment_counts = (
        db.query(
            FeatureRequestComment.feature_request_id,
            func.count(FeatureRequestComment.id).label("comment_count"),
        )
        .group_by(FeatureRequestComment.feature_request_id)
        .subquery()
    )

    user_upvotes = (
        db.query(FeatureRequestUpvote.feature_request_id)
        .filter(FeatureRequestUpvote.user_id == current_user.id)
        .subquery()
    )

    query = (
        db.query(
            FeatureRequest,
            User.name.label("submitter_name"),
            func.coalesce(upvote_counts.c.upvote_count, 0).label("upvote_count"),
            func.coalesce(comment_counts.c.comment_count, 0).label("comment_count"),
            user_upvotes.c.feature_request_id.isnot(None).label("user_has_upvoted"),
        )
        .join(User, FeatureRequest.submitter_id == User.id)
        .outerjoin(upvote_counts, FeatureRequest.id == upvote_counts.c.feature_request_id)
        .outerjoin(comment_counts, FeatureRequest.id == comment_counts.c.feature_request_id)
        .outerjoin(user_upvotes, FeatureRequest.id == user_upvotes.c.feature_request_id)
    )

    return query, upvote_counts


def _enrich_feature_request(row) -> FeatureRequestResponse:
    """Build a FeatureRequestResponse from an enriched query row."""
    fr = row[0]  # FeatureRequest model instance
    return FeatureRequestResponse(
        id=fr.id,
        title=fr.title,
        description=fr.description,
        category=fr.category,
        status=fr.status,
        admin_response=fr.admin_response,
        submitter_id=fr.submitter_id,
        submitter_name=row.submitter_name,
        upvote_count=row.upvote_count,
        comment_count=row.comment_count,
        user_has_upvoted=bool(row.user_has_upvoted),
        created_at=fr.created_at,
        updated_at=fr.updated_at,
    )


# ── Feature Request CRUD ────────────────────────────────────────────────────


@router.post("", response_model=FeatureRequestResponse, status_code=status.HTTP_201_CREATED)
def create_feature_request(
    body: FeatureRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FeatureRequestResponse:
    """Submit a new feature request."""
    fr = FeatureRequest(
        title=body.title,
        description=body.description,
        category=body.category.value,
        submitter_id=current_user.id,
    )
    db.add(fr)
    db.commit()
    db.refresh(fr)

    # Return the enriched response (fresh record has 0 upvotes/comments)
    return FeatureRequestResponse(
        id=fr.id,
        title=fr.title,
        description=fr.description,
        category=fr.category,
        status=fr.status,
        admin_response=fr.admin_response,
        submitter_id=fr.submitter_id,
        submitter_name=current_user.name,
        upvote_count=0,
        comment_count=0,
        user_has_upvoted=False,
        created_at=fr.created_at,
        updated_at=fr.updated_at,
    )


@router.get("", response_model=FeatureRequestListResponse)
def list_feature_requests(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    sort: str = Query(default="newest", regex="^(newest|most_upvoted)$"),
    status_filter: str | None = Query(default=None, alias="status"),
    category: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FeatureRequestListResponse:
    """List feature requests with pagination, sorting, and optional filters."""
    query, upvote_counts = _build_enriched_query(db, current_user)

    # Apply optional filters
    if status_filter:
        query = query.filter(FeatureRequest.status == status_filter)
    if category:
        query = query.filter(FeatureRequest.category == category)

    # Use a simple count query without JOINs for efficiency
    count_query = db.query(func.count(FeatureRequest.id))
    if status_filter:
        count_query = count_query.filter(FeatureRequest.status == status_filter)
    if category:
        count_query = count_query.filter(FeatureRequest.category == category)
    total = count_query.scalar()

    # Apply sorting
    if sort == "most_upvoted":
        query = query.order_by(func.coalesce(upvote_counts.c.upvote_count, 0).desc())
    else:
        query = query.order_by(FeatureRequest.created_at.desc())

    # Apply pagination
    rows = query.offset((page - 1) * per_page).limit(per_page).all()

    return FeatureRequestListResponse(
        items=[_enrich_feature_request(row) for row in rows],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/{feature_request_id}", response_model=FeatureRequestResponse)
def get_feature_request(
    feature_request_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FeatureRequestResponse:
    """Get a single feature request with enriched fields."""
    query, _upvote_counts = _build_enriched_query(db, current_user)
    row = query.filter(FeatureRequest.id == feature_request_id).first()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feature request not found",
        )

    return _enrich_feature_request(row)


@router.put("/{feature_request_id}", response_model=FeatureRequestResponse)
def update_feature_request(
    feature_request_id: str,
    body: FeatureRequestUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> FeatureRequestResponse:
    """Admin: edit a feature request's title, description, or category."""
    fr = db.query(FeatureRequest).filter(FeatureRequest.id == feature_request_id).first()
    if not fr:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feature request not found",
        )

    # Only update fields that are provided
    if body.title is not None:
        fr.title = body.title
    if body.description is not None:
        fr.description = body.description
    if body.category is not None:
        fr.category = body.category.value

    db.commit()
    db.refresh(fr)

    # Re-fetch with enrichment
    query, _upvote_counts = _build_enriched_query(db, current_user)
    row = query.filter(FeatureRequest.id == feature_request_id).first()
    return _enrich_feature_request(row)


@router.delete("/{feature_request_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_feature_request(
    feature_request_id: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> None:
    """Admin: delete a feature request."""
    fr = db.query(FeatureRequest).filter(FeatureRequest.id == feature_request_id).first()
    if not fr:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feature request not found",
        )

    db.delete(fr)
    db.commit()


# ── Status Update ────────────────────────────────────────────────────────────


@router.patch("/{feature_request_id}/status", response_model=FeatureRequestResponse)
def update_feature_request_status(
    feature_request_id: str,
    body: FeatureStatusUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> FeatureRequestResponse:
    """Admin: update a feature request's status with an optional admin response."""
    fr = db.query(FeatureRequest).filter(FeatureRequest.id == feature_request_id).first()
    if not fr:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feature request not found",
        )

    fr.status = body.status.value
    if body.admin_response is not None:
        fr.admin_response = body.admin_response

    db.commit()
    db.refresh(fr)

    # Notify the submitter about the status change
    create_notification_safe(
        db,
        user_id=fr.submitter_id,
        notification_type=NotificationType.feature_status_change,
        title="Feature Request Updated",
        message=f"Your feature request \"{fr.title}\" has been updated to \"{body.status.value.replace('_', ' ')}\".",
        resource_type="feature_request",
        resource_id=fr.id,
    )

    # Re-fetch with enrichment
    query, _upvote_counts = _build_enriched_query(db, current_user)
    row = query.filter(FeatureRequest.id == feature_request_id).first()
    return _enrich_feature_request(row)


# ── Upvotes ──────────────────────────────────────────────────────────────────


@router.post("/{feature_request_id}/upvote", response_model=UpvoteResponse)
def toggle_upvote(
    feature_request_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UpvoteResponse:
    """Toggle upvote on a feature request. If not upvoted, create; if already upvoted, remove."""
    # Verify the feature request exists
    fr = db.query(FeatureRequest).filter(FeatureRequest.id == feature_request_id).first()
    if not fr:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feature request not found",
        )

    # Check if user already upvoted
    existing = (
        db.query(FeatureRequestUpvote)
        .filter(
            FeatureRequestUpvote.feature_request_id == feature_request_id,
            FeatureRequestUpvote.user_id == current_user.id,
        )
        .first()
    )

    if existing:
        # Already upvoted -> remove
        db.delete(existing)
        db.commit()
        upvoted = False
    else:
        # Not upvoted -> create
        upvote = FeatureRequestUpvote(
            feature_request_id=feature_request_id,
            user_id=current_user.id,
        )
        db.add(upvote)
        try:
            db.commit()
            upvoted = True
        except IntegrityError:
            # Race condition: another request already created the upvote.
            # Treat as "already upvoted" and remove it instead.
            db.rollback()
            existing = (
                db.query(FeatureRequestUpvote)
                .filter(
                    FeatureRequestUpvote.feature_request_id == feature_request_id,
                    FeatureRequestUpvote.user_id == current_user.id,
                )
                .first()
            )
            if existing:
                db.delete(existing)
                db.commit()
            upvoted = False

    # Get current upvote count
    upvote_count = (
        db.query(func.count(FeatureRequestUpvote.id))
        .filter(FeatureRequestUpvote.feature_request_id == feature_request_id)
        .scalar()
    )

    return UpvoteResponse(upvoted=upvoted, upvote_count=upvote_count)


# ── Comments ─────────────────────────────────────────────────────────────────


@router.post("/{feature_request_id}/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
def create_comment(
    feature_request_id: str,
    body: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CommentResponse:
    """Add a comment to a feature request."""
    fr = db.query(FeatureRequest).filter(FeatureRequest.id == feature_request_id).first()
    if not fr:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feature request not found",
        )

    comment = FeatureRequestComment(
        feature_request_id=feature_request_id,
        user_id=current_user.id,
        content=body.content,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    # Notify the submitter about the new comment (skip if commenter IS submitter)
    if fr.submitter_id != current_user.id:
        create_notification_safe(
            db,
            user_id=fr.submitter_id,
            notification_type=NotificationType.feature_comment,
            title="New Comment on Feature Request",
            message=f"{current_user.name} commented on your feature request \"{fr.title}\".",
            resource_type="feature_request",
            resource_id=fr.id,
        )

    return CommentResponse(
        id=comment.id,
        feature_request_id=comment.feature_request_id,
        user_id=comment.user_id,
        user_name=current_user.name,
        content=comment.content,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
    )


@router.get("/{feature_request_id}/comments", response_model=list[CommentResponse])
def list_comments(
    feature_request_id: str,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[CommentResponse]:
    """List all comments for a feature request."""
    # Verify feature request exists
    fr = db.query(FeatureRequest).filter(FeatureRequest.id == feature_request_id).first()
    if not fr:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feature request not found",
        )

    rows = (
        db.query(FeatureRequestComment, User.name.label("user_name"))
        .join(User, FeatureRequestComment.user_id == User.id)
        .filter(FeatureRequestComment.feature_request_id == feature_request_id)
        .order_by(FeatureRequestComment.created_at.asc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return [
        CommentResponse(
            id=comment.id,
            feature_request_id=comment.feature_request_id,
            user_id=comment.user_id,
            user_name=user_name,
            content=comment.content,
            created_at=comment.created_at,
            updated_at=comment.updated_at,
        )
        for comment, user_name in rows
    ]


@router.put("/{feature_request_id}/comments/{comment_id}", response_model=CommentResponse)
def update_comment(
    feature_request_id: str,
    comment_id: str,
    body: CommentUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> CommentResponse:
    """Admin: edit a comment."""
    comment = (
        db.query(FeatureRequestComment)
        .filter(
            FeatureRequestComment.id == comment_id,
            FeatureRequestComment.feature_request_id == feature_request_id,
        )
        .first()
    )
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found",
        )

    comment.content = body.content
    db.commit()
    db.refresh(comment)

    # Fetch the commenter's name
    user = db.query(User).filter(User.id == comment.user_id).first()

    return CommentResponse(
        id=comment.id,
        feature_request_id=comment.feature_request_id,
        user_id=comment.user_id,
        user_name=user.name if user else "Unknown",
        content=comment.content,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
    )


@router.delete("/{feature_request_id}/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    feature_request_id: str,
    comment_id: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> None:
    """Admin: delete a comment."""
    comment = (
        db.query(FeatureRequestComment)
        .filter(
            FeatureRequestComment.id == comment_id,
            FeatureRequestComment.feature_request_id == feature_request_id,
        )
        .first()
    )
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found",
        )

    db.delete(comment)
    db.commit()
