"""Tests for the parser service."""

from typing import Any

import pytest
from unittest.mock import AsyncMock, MagicMock

from fastapi import HTTPException

from app.services.parser import parse_file


def create_mock_upload_file(filename: str, content: bytes) -> Any:
    """Create a mock UploadFile for testing."""
    file = MagicMock()
    file.filename = filename
    file.read = AsyncMock(return_value=content)
    return file


@pytest.mark.asyncio
async def test_parse_valid_txt_file() -> None:
    """Test that valid .txt files are parsed correctly."""
    content = b"This is a test meeting note.\n\nWith multiple paragraphs."
    file = create_mock_upload_file("meeting.txt", content)

    result = await parse_file(file)

    assert result == "This is a test meeting note.\n\nWith multiple paragraphs."


@pytest.mark.asyncio
async def test_parse_valid_md_file() -> None:
    """Test that valid .md files are parsed correctly."""
    content = b"# Meeting Notes\n\n- Item 1\n- Item 2\n- Item 3"
    file = create_mock_upload_file("meeting.md", content)

    result = await parse_file(file)

    assert result == "# Meeting Notes\n\n- Item 1\n- Item 2\n- Item 3"


@pytest.mark.asyncio
async def test_parse_txt_file_uppercase_extension() -> None:
    """Test that .TXT extension (uppercase) is accepted."""
    content = b"Test content"
    file = create_mock_upload_file("meeting.TXT", content)

    result = await parse_file(file)

    assert result == "Test content"


@pytest.mark.asyncio
async def test_parse_md_file_uppercase_extension() -> None:
    """Test that .MD extension (uppercase) is accepted."""
    content = b"# Test"
    file = create_mock_upload_file("meeting.MD", content)

    result = await parse_file(file)

    assert result == "# Test"


@pytest.mark.asyncio
async def test_reject_file_over_50kb_limit() -> None:
    """Test that files over 50KB are rejected with HTTPException 400."""
    # Create content just over 50KB (50 * 1024 + 1 bytes)
    content = b"x" * (50 * 1024 + 1)
    file = create_mock_upload_file("large_meeting.txt", content)

    with pytest.raises(HTTPException) as exc_info:
        await parse_file(file)

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "File too large. Maximum size is 50KB."


@pytest.mark.asyncio
async def test_accept_file_at_exactly_50kb() -> None:
    """Test that files exactly at 50KB are accepted."""
    # Create content exactly 50KB (50 * 1024 bytes)
    content = b"x" * (50 * 1024)
    file = create_mock_upload_file("exact_size.txt", content)

    result = await parse_file(file)

    assert len(result) == 50 * 1024


@pytest.mark.asyncio
async def test_reject_unsupported_file_type_pdf() -> None:
    """Test that .pdf files are rejected with HTTPException 400."""
    content = b"PDF content"
    file = create_mock_upload_file("document.pdf", content)

    with pytest.raises(HTTPException) as exc_info:
        await parse_file(file)

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Unsupported file type. Use .txt or .md"


@pytest.mark.asyncio
async def test_reject_unsupported_file_type_docx() -> None:
    """Test that .docx files are rejected with HTTPException 400."""
    content = b"DOCX content"
    file = create_mock_upload_file("document.docx", content)

    with pytest.raises(HTTPException) as exc_info:
        await parse_file(file)

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Unsupported file type. Use .txt or .md"


@pytest.mark.asyncio
async def test_reject_file_without_extension() -> None:
    """Test that files without extension are rejected."""
    content = b"Some content"
    file = create_mock_upload_file("meeting_notes", content)

    with pytest.raises(HTTPException) as exc_info:
        await parse_file(file)

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Unsupported file type. Use .txt or .md"


@pytest.mark.asyncio
async def test_reject_file_with_empty_filename() -> None:
    """Test that files with empty filename are rejected."""
    content = b"Some content"
    file = create_mock_upload_file("", content)

    with pytest.raises(HTTPException) as exc_info:
        await parse_file(file)

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Unsupported file type. Use .txt or .md"
