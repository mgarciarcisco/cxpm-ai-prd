"""Extractor service for processing meeting notes with LLM."""

import json
from datetime import datetime
from pathlib import Path
from typing import Any, AsyncIterator
from uuid import UUID

from sqlalchemy.orm import Session

from app.config import settings
from app.models import MeetingRecap, MeetingItem
from app.models.meeting_item import Section
from app.models.meeting_recap import MeetingStatus
from app.services.llm import get_provider, LLMError
from app.services.chunker import chunk_text


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


def _deduplicate_items(items_data: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Deduplicate items by exact content match.

    Items with identical content within the same section are considered duplicates.
    The first occurrence is kept.

    Args:
        items_data: List of extracted item dictionaries.

    Returns:
        Deduplicated list of items.
    """
    seen: set[tuple[str, str]] = set()  # (section, content)
    deduplicated: list[dict[str, Any]] = []

    for item in items_data:
        key = (item["section"], item["content"])
        if key not in seen:
            seen.add(key)
            deduplicated.append(item)

    return deduplicated


def _extract_single_chunk(
    raw_text: str,
    prompt_template: str,
    max_attempts: int
) -> list[dict[str, Any]]:
    """Extract items from a single chunk of text.

    Args:
        raw_text: The text chunk to process.
        prompt_template: The prompt template with {meeting_notes} placeholder.
        max_attempts: Maximum number of retry attempts.

    Returns:
        List of extracted item dictionaries.

    Raises:
        ExtractionError: If extraction fails after all retries.
    """
    prompt = prompt_template.replace("{meeting_notes}", raw_text)
    last_error: Exception | None = None

    for attempt in range(max_attempts):
        try:
            provider = get_provider()
            response = provider.generate(prompt)
            items_data = _parse_llm_response(response)
            return items_data

        except (ExtractionError, LLMError) as e:
            last_error = e
            if attempt >= max_attempts - 1:
                break
            continue
        except Exception as e:
            last_error = ExtractionError(f"Unexpected error during extraction: {e}")
            if attempt >= max_attempts - 1:
                break
            continue

    raise ExtractionError(f"Chunk extraction failed after {max_attempts} attempts: {last_error}")


def extract(meeting_id: UUID, db: Session) -> list[MeetingItem]:
    """Extract structured items from meeting notes using LLM.

    This function:
    1. Loads the meeting from the database
    2. Checks if input exceeds CHUNK_SIZE_CHARS and chunks if needed
    3. Calls the LLM with the extraction prompt for each chunk
    4. Merges and deduplicates results from all chunks
    5. Creates MeetingItem records
    6. Updates meeting status

    On failure, it retries once for malformed output or timeout (per chunk).

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

    # Determine retry attempts
    max_attempts = settings.LLM_MAX_RETRIES + 1

    try:
        # Check if we need to chunk the input
        raw_input = meeting.raw_input
        all_items_data: list[dict[str, Any]] = []

        if len(raw_input) > settings.CHUNK_SIZE_CHARS:
            # Chunk the input and process each chunk separately
            chunks = chunk_text(raw_input, settings.CHUNK_SIZE_CHARS)

            for chunk in chunks:
                chunk_items = _extract_single_chunk(chunk, prompt_template, max_attempts)
                all_items_data.extend(chunk_items)

            # Deduplicate items by exact content match
            all_items_data = _deduplicate_items(all_items_data)
        else:
            # Process as single piece (no chunking needed)
            all_items_data = _extract_single_chunk(raw_input, prompt_template, max_attempts)

        # Create meeting items
        items = _create_meeting_items(str(meeting_id), all_items_data, db)

        # Update meeting status to processed
        meeting.status = MeetingStatus.processed
        meeting.processed_at = datetime.utcnow()  # type: ignore[assignment]
        meeting.prompt_version = PROMPT_VERSION  # type: ignore[assignment]
        meeting.error_message = None  # type: ignore[assignment]
        db.commit()

        return items

    except ExtractionError as e:
        # Update meeting status to failed
        meeting.status = MeetingStatus.failed
        meeting.failed_at = datetime.utcnow()  # type: ignore[assignment]
        meeting.error_message = str(e)  # type: ignore[assignment]
        meeting.prompt_version = PROMPT_VERSION  # type: ignore[assignment]
        db.commit()

        raise

    except Exception as e:
        # Unexpected error - update meeting status to failed
        error_msg = f"Unexpected error during extraction: {e}"
        meeting.status = MeetingStatus.failed
        meeting.failed_at = datetime.utcnow()  # type: ignore[assignment]
        meeting.error_message = error_msg  # type: ignore[assignment]
        meeting.prompt_version = PROMPT_VERSION  # type: ignore[assignment]
        db.commit()

        raise ExtractionError(error_msg)


def _parse_streaming_json(accumulated: str) -> tuple[list[dict[str, Any]], str]:
    """Attempt to parse complete JSON items from accumulated text.

    This function tries to extract complete JSON array items from a partially
    streamed JSON response. It looks for complete JSON objects within the array.

    Args:
        accumulated: The accumulated text from streaming.

    Returns:
        A tuple of (parsed_items, remaining_text). parsed_items contains
        fully parsed item dictionaries, remaining_text is what's left to parse.
    """
    # Clean the accumulated text
    cleaned = accumulated.strip()

    # Strip markdown code blocks if present
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()

    # If it doesn't start with '[', we don't have a valid JSON array yet
    if not cleaned.startswith("["):
        return [], accumulated

    parsed_items: list[dict[str, Any]] = []
    valid_sections = {s.value for s in Section}

    # Try to parse progressively larger portions
    # Look for complete JSON objects by finding matching braces
    brace_count = 0
    in_string = False
    escape_next = False
    item_start = -1

    for i, char in enumerate(cleaned):
        if escape_next:
            escape_next = False
            continue

        if char == "\\" and in_string:
            escape_next = True
            continue

        if char == '"' and not escape_next:
            in_string = not in_string
            continue

        if in_string:
            continue

        if char == "[" and item_start == -1:
            # Start of array
            continue

        if char == "{":
            if brace_count == 0:
                item_start = i
            brace_count += 1

        if char == "}":
            brace_count -= 1
            if brace_count == 0 and item_start != -1:
                # We have a complete object
                item_str = cleaned[item_start : i + 1]
                try:
                    item = json.loads(item_str)
                    if (
                        isinstance(item, dict)
                        and "section" in item
                        and "content" in item
                        and item["section"] in valid_sections
                    ):
                        parsed_items.append(item)
                except json.JSONDecodeError:
                    pass
                item_start = -1

    return parsed_items, accumulated


async def extract_stream(
    meeting_id: UUID, db: Session
) -> AsyncIterator[dict[str, Any]]:
    """Stream extracted items from meeting notes using LLM.

    This async generator function:
    1. Loads the meeting from the database
    2. Updates status to processing
    3. Streams LLM response and yields individual items as they are parsed
    4. Updates meeting status to processed when complete

    Args:
        meeting_id: The UUID of the meeting to process.
        db: Database session.

    Yields:
        Individual MeetingItem dictionaries as they are extracted:
        {"section": "...", "content": "...", "source_quote": "..."}

    Raises:
        ExtractionError: If the meeting is not found or extraction fails.
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

    try:
        raw_input = meeting.raw_input
        all_items_data: list[dict[str, Any]] = []
        yielded_items: set[tuple[str, str]] = set()  # Track (section, content) for dedup

        # Determine if we need to chunk
        if len(raw_input) > settings.CHUNK_SIZE_CHARS:
            chunks = chunk_text(raw_input, settings.CHUNK_SIZE_CHARS)
        else:
            chunks = [raw_input]

        for chunk in chunks:
            prompt = prompt_template.replace("{meeting_notes}", chunk)
            provider = get_provider()

            accumulated = ""
            async for text_chunk in provider.stream(prompt):
                accumulated += text_chunk

                # Try to parse complete items from accumulated text
                parsed_items, _ = _parse_streaming_json(accumulated)

                # Yield any new items that we haven't yielded yet
                for item in parsed_items:
                    key = (item["section"], item["content"])
                    if key not in yielded_items:
                        yielded_items.add(key)
                        all_items_data.append(item)
                        yield item

        # Create meeting items in database
        _create_meeting_items(str(meeting_id), all_items_data, db)

        # Update meeting status to processed
        meeting.status = MeetingStatus.processed
        meeting.processed_at = datetime.utcnow()  # type: ignore[assignment]
        meeting.prompt_version = PROMPT_VERSION  # type: ignore[assignment]
        meeting.error_message = None  # type: ignore[assignment]
        db.commit()

    except (ExtractionError, LLMError) as e:
        # Update meeting status to failed
        meeting.status = MeetingStatus.failed
        meeting.failed_at = datetime.utcnow()  # type: ignore[assignment]
        meeting.error_message = str(e)  # type: ignore[assignment]
        meeting.prompt_version = PROMPT_VERSION  # type: ignore[assignment]
        db.commit()
        raise ExtractionError(str(e))

    except Exception as e:
        # Unexpected error - update meeting status to failed
        error_msg = f"Unexpected error during extraction: {e}"
        meeting.status = MeetingStatus.failed
        meeting.failed_at = datetime.utcnow()  # type: ignore[assignment]
        meeting.error_message = error_msg  # type: ignore[assignment]
        meeting.prompt_version = PROMPT_VERSION  # type: ignore[assignment]
        db.commit()
        raise ExtractionError(error_msg)
