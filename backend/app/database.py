"""Database configuration and session management using SQLAlchemy."""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from app.config import settings

# Create SQLAlchemy engine using DATABASE_URL from config
# For SQLite, we need connect_args to allow usage across threads
_engine_kwargs = {}
if settings.DATABASE_URL.startswith("sqlite"):
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    _engine_kwargs["pool_size"] = 5
    _engine_kwargs["max_overflow"] = 10

engine = create_engine(settings.DATABASE_URL, **_engine_kwargs)

# SessionLocal factory with autocommit=False, autoflush=False
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base declarative class for model inheritance
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """Dependency function that yields a database session and closes it after request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
