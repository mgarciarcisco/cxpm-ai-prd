"""Extractor service for processing meeting notes with LLM."""

import json
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.config import settings
from app.models import MeetingRecap, MeetingItem
from app.models.meeting_item import Section
from app.models.meeting_recap import MeetingStatus
from app.services.llm import get_provider, LLMError


# Path to the extraction prompt template
PROMPT_PATH = Path(__file__).parent.parent.parent / "prompts" / "extract_meeting_v1.txt"
PROMPT_VERSION = "extract_v1"


class ExtractionError(Exception):
    """Exception raised when extraction fails."""
    pass


def _load_prompt() -> str:
    """Load the extraction prompt template from file.

    Returns:
        The prompt template string with {meeting_notes} placeholder.

    Raises:
        ExtractionError: If the prompt file cannot be loaded.
    """
    try:
        return PROMPT_PATH.read_text(encoding="utf-8")
    except Exception as e:
        raise ExtractionError(f"Failed to load extraction prompt: {e}")


def _parse_llm_response(response: str) -> list[dict[str, Any]]:
    """Parse the LLM response as JSON.

    Args:
        response: The raw LLM response string.

    Returns:
        A list of extracted item dictionaries.

    Raises:
        ExtractionError: If the response is not valid JSON or has unexpected structure.
    """
    # Strip any markdown code blocks that might be present
    cleaned = response.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise ExtractionError(f"Invalid JSON response from LLM: {e}")

    if not isinstance(parsed, list):
        raise ExtractionError("LLM response must be a JSON array")

    # Validate each item has required fields
    valid_sections = {s.value for s in Section}
    for i, item in enumerate(parsed):
        if not isinstance(item, dict):
            raise ExtractionError(f"Item {i} is not a dictionary")
        if "section" not in item:
            raise ExtractionError(f"Item {i} missing 'section' field")
        if "content" not in item:
            raise ExtractionError(f"Item {i} missing 'content' field")
        if item["section"] not in valid_sections:
            raise ExtractionError(f"Item {i} has invalid section: {item['section']}")

    return parsed


def _create_meeting_items(
    meeting_id: str,
    items_data: list[dict[str, Any]],
    db: Session
) -> list[MeetingItem]:
    """Create MeetingItem records from extracted data.

    Args:
        meeting_id: The meeting ID to associate items with.
        items_data: List of extracted item dictionaries.
        db: Database session.

    Returns:
        List of created MeetingItem objects.
    """
    # Group items by section to calculate order
    section_counts: dict[str, int] = {}
    items = []

    for item_data in items_data:
        section = item_data["section"]
        section_counts[section] = section_counts.get(section, 0) + 1

        item = MeetingItem(
            meeting_id=meeting_id,
            section=Section(section),
            content=item_data["content"],
            source_quote=item_data.get("source_quote"),
            order=section_counts[section] - 1,  # 0-indexed
            is_deleted=False
        )
        db.add(item)
        items.append(item)

    return items


def extract(meeting_id: UUID, db: Session) -> list[MeetingItem]:
    """Extract structured items from meeting notes using LLM.

    This function:
    1. Loads the meeting from the database
    2. Calls the LLM with the extraction prompt
    3. Parses the JSON response
    4. Creates MeetingItem records
    5. Updates meeting status

    On failure, it retries once for malformed output or timeout.

    Args:
        meeting_id: The UUID of the meeting to process.
        db: Database session.

    Returns:
        List of created MeetingItem objects.

    Raises:
        ExtractionError: If the meeting is not found or extraction fails after retries.
    """
    # Load the meeting
    meeting = db.query(MeetingRecap).filter(MeetingRecap.id == str(meeting_id)).first()
    if not meeting:
        raise ExtractionError(f"Meeting not found: {meeting_id}")

    # Update status to processing
    meeting.status = MeetingStatus.processing
    db.commit()

    # Load prompt template
    prompt_template = _load_prompt()
    prompt = prompt_template.replace("{meeting_notes}", meeting.raw_input)

    # Attempt extraction with retry logic
    max_attempts = settings.LLM_MAX_RETRIES + 1
    last_error: Exception | None = None

    for attempt in range(max_attempts):
        try:
            # Get LLM provider and generate response
            provider = get_provider()
            response = provider.generate(prompt)

            # Parse the response
            items_data = _parse_llm_response(response)

            # Create meeting items
            items = _create_meeting_items(str(meeting_id), items_data, db)

            # Update meeting status to processed
            meeting.status = MeetingStatus.processed
            meeting.processed_at = datetime.utcnow()  # type: ignore[assignment]
            meeting.prompt_version = PROMPT_VERSION  # type: ignore[assignment]
            meeting.error_message = None  # type: ignore[assignment]
            db.commit()

            return items

        except (ExtractionError, LLMError) as e:
            last_error = e
            # On last attempt, don't retry
            if attempt >= max_attempts - 1:
                break
            # Otherwise, continue to retry
            continue
        except Exception as e:
            # Unexpected error - treat as extraction error
            last_error = ExtractionError(f"Unexpected error during extraction: {e}")
            if attempt >= max_attempts - 1:
                break
            continue

    # All attempts failed - update meeting status to failed
    meeting.status = MeetingStatus.failed
    meeting.failed_at = datetime.utcnow()  # type: ignore[assignment]
    meeting.error_message = str(last_error) if last_error else "Unknown error"  # type: ignore[assignment]
    meeting.prompt_version = PROMPT_VERSION  # type: ignore[assignment]
    db.commit()

    raise ExtractionError(f"Extraction failed after {max_attempts} attempts: {last_error}")
