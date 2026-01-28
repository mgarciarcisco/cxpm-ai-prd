"""File parser service for processing uploaded meeting notes."""

from fastapi import HTTPException, UploadFile

from app.config import settings


async def parse_file(file: UploadFile) -> str:
    """
    Parse an uploaded file and return its content as a string.

    Args:
        file: The uploaded file (UploadFile from FastAPI)

    Returns:
        The file content as a string

    Raises:
        HTTPException: 400 if file is too large or has unsupported type
    """
    # Check file extension
    filename = file.filename or ""
    if not filename.lower().endswith((".txt", ".md")):
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Use .txt or .md",
        )

    # Read file content
    content = await file.read()

    # Check file size
    max_size_bytes = settings.MAX_FILE_SIZE_KB * 1024
    if len(content) > max_size_bytes:
        raise HTTPException(
            status_code=400,
            detail="File too large. Maximum size is 50KB.",
        )

    # Decode and return content
    return content.decode("utf-8")
