"""Authentication API endpoints: register, login, and current user info."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.auth import (
    create_access_token,
    get_current_user,
    hash_password,
    validate_password_strength,
    verify_password,
)
from app.activity import log_activity_safe
from app.database import get_db
from app.models.user import User
from app.schemas.auth import PasswordChange, ProfileUpdate, TokenResponse, UserLogin, UserRegister, UserResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(payload: UserRegister, request: Request, db: Session = Depends(get_db)):
    """Register a new user. First registered user gets is_admin=True and is auto-approved."""
    # Validate email domain
    if not payload.email.lower().endswith("@cisco.com"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only @cisco.com email addresses are allowed",
        )

    # Validate password strength
    password_errors = validate_password_strength(payload.password)
    if password_errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=password_errors[0],
        )

    # Check if email already exists
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    # First real user becomes admin (ignore system user with is_active=False)
    is_first_user = db.query(User).filter(User.is_active == True).count() == 0  # noqa: E712

    user = User(
        email=payload.email,
        name=payload.name,
        hashed_password=hash_password(payload.password),
        is_admin=is_first_user,
        is_approved=is_first_user,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    log_activity_safe(db, user.id, "user.register", metadata={"email": user.email}, request=request)

    # First user (admin) is auto-approved — return token
    if is_first_user:
        token = create_access_token(user.id)
        return TokenResponse(access_token=token)

    # All other users are pending approval — return message, no token
    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content={
            "message": "Registration successful. Your account is pending admin approval.",
            "status": "pending_approval",
        },
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: UserLogin, request: Request, db: Session = Depends(get_db)) -> TokenResponse:
    """Authenticate user with email and password, return JWT token."""
    user = db.query(User).filter(User.email == payload.email).first()

    # Check account lock before password verification
    now = datetime.now(timezone.utc)
    if user and user.locked_until:
        # SQLite stores naive datetimes, so make both comparable
        locked = user.locked_until.replace(tzinfo=timezone.utc) if user.locked_until.tzinfo is None else user.locked_until
        if locked > now:
            minutes_left = max(1, int((locked - now).total_seconds()) // 60)
            log_activity_safe(db, user.id, "user.login_locked", metadata={"email": payload.email, "locked_until": str(user.locked_until)}, request=request)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Account locked. Try again in {minutes_left} minutes.",
            )

    # Verify password and handle failed attempts
    if not user or not verify_password(payload.password, user.hashed_password):
        if user:
            user.failed_login_attempts += 1
            if user.failed_login_attempts >= 5:
                user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=15)
            db.commit()
            log_activity_safe(db, user.id, "user.login_failed", metadata={"email": payload.email, "attempt_count": user.failed_login_attempts}, request=request)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Check approval and active status
    if not user.is_approved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="pending_approval",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="account_deactivated",
        )

    # Successful login — reset lockout fields and update last_login_at
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()

    token = create_access_token(user.id)

    log_activity_safe(db, user.id, "user.login", request=request)

    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)) -> UserResponse:
    """Return the currently authenticated user's info."""
    return UserResponse.model_validate(current_user)


@router.put("/profile")
def update_profile(
    payload: ProfileUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the current user's profile (name only)."""
    current_user.name = payload.name
    db.commit()
    db.refresh(current_user)

    log_activity_safe(db, current_user.id, "user.profile_updated", request=request)
    return UserResponse.model_validate(current_user)


@router.put("/password")
def change_password(
    payload: PasswordChange,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change the current user's password."""
    # Verify current password
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    # Validate new password strength
    password_errors = validate_password_strength(payload.new_password)
    if password_errors:
        raise HTTPException(status_code=400, detail=password_errors[0])

    current_user.hashed_password = hash_password(payload.new_password)
    db.commit()

    log_activity_safe(db, current_user.id, "user.password_changed", request=request)
    return {"message": "Password changed successfully"}
