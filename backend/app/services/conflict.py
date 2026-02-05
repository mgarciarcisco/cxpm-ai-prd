"""Conflict detection service for identifying duplicates and conflicts when applying meeting items."""

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.config import settings
from app.models import MeetingItem, MeetingRecap, Requirement
from app.models.meeting_item import Section
from app.models.meeting_recap import MeetingStatus
from app.services.llm import LLMError, get_provider

logger = logging.getLogger(__name__)

# Path to the conflict classification prompt templates
PROMPT_PATH = Path(__file__).parent.parent.parent / "prompts" / "classify_conflict_v1.txt"
BATCH_PROMPT_PATH = Path(__file__).parent.parent.parent / "prompts" / "classify_conflict_batch_v1.txt"

# Batch size for LLM classification (how many items to classify in one call)
BATCH_SIZE = 10


class ConflictDetectionError(Exception):
    """Exception raised when conflict detection fails."""
    pass


@dataclass
class ConflictResult:
    """Result of conflict detection for a single meeting item."""
    item: MeetingItem
    decision: str  # 'added', 'skipped_duplicate', 'skipped_semantic', 'conflict'
    reason: str
    matched_requirement: Requirement | None = None
    classification: str | None = None  # 'duplicate', 'new', 'refinement', 'contradiction'


@dataclass
class ConflictDetectionResult:
    """Complete result of conflict detection for a meeting."""
    added: list[ConflictResult] = field(default_factory=list)
    skipped: list[ConflictResult] = field(default_factory=list)
    conflicts: list[ConflictResult] = field(default_factory=list)


def _load_prompt() -> str:
    """Load the conflict classification prompt template from file.

    Returns:
        The prompt template string with {existing_content} and {new_content} placeholders.

    Raises:
        ConflictDetectionError: If the prompt file cannot be loaded.
    """
    try:
        return PROMPT_PATH.read_text(encoding="utf-8")
    except Exception as e:
        raise ConflictDetectionError(f"Failed to load conflict classification prompt: {e}")


def _load_batch_prompt() -> str:
    """Load the batch conflict classification prompt template from file.

    Returns:
        The prompt template string with {existing_requirements} and {new_items} placeholders.

    Raises:
        ConflictDetectionError: If the prompt file cannot be loaded.
    """
    try:
        return BATCH_PROMPT_PATH.read_text(encoding="utf-8")
    except Exception as e:
        raise ConflictDetectionError(f"Failed to load batch conflict classification prompt: {e}")


def _parse_classification_response(response: str) -> dict[str, Any]:
    """Parse the LLM classification response as JSON.

    Args:
        response: The raw LLM response string.

    Returns:
        A dictionary with 'classification' and 'reason' keys.

    Raises:
        ConflictDetectionError: If the response is not valid JSON or has unexpected structure.
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
        raise ConflictDetectionError(f"Invalid JSON response from LLM: {e}")

    if not isinstance(parsed, dict):
        raise ConflictDetectionError("LLM response must be a JSON object")

    if "classification" not in parsed:
        raise ConflictDetectionError("LLM response missing 'classification' field")

    valid_classifications = {"duplicate", "new", "refinement", "contradiction"}
    if parsed["classification"] not in valid_classifications:
        raise ConflictDetectionError(
            f"Invalid classification: {parsed['classification']}. "
            f"Must be one of: {valid_classifications}"
        )

    return parsed


def _parse_batch_classification_response(response: str, expected_count: int) -> list[dict[str, Any]]:
    """Parse the LLM batch classification response as JSON array.

    Args:
        response: The raw LLM response string.
        expected_count: The expected number of classifications.

    Returns:
        A list of dictionaries with 'item_index', 'classification', 'reason', and optionally 'matched_requirement_index'.

    Raises:
        ConflictDetectionError: If the response is not valid JSON or has unexpected structure.
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

    # Find JSON array boundaries
    start = cleaned.find("[")
    end = cleaned.rfind("]") + 1
    if start >= 0 and end > start:
        cleaned = cleaned[start:end]

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise ConflictDetectionError(f"Invalid JSON response from LLM batch classification: {e}")

    if not isinstance(parsed, list):
        raise ConflictDetectionError("LLM batch response must be a JSON array")

    valid_classifications = {"duplicate", "new", "refinement", "contradiction"}
    
    for item in parsed:
        if not isinstance(item, dict):
            raise ConflictDetectionError("Each item in batch response must be a JSON object")
        if "item_index" not in item:
            raise ConflictDetectionError("Batch response item missing 'item_index' field")
        if "classification" not in item:
            raise ConflictDetectionError("Batch response item missing 'classification' field")
        if item["classification"] not in valid_classifications:
            raise ConflictDetectionError(
                f"Invalid classification: {item['classification']}. "
                f"Must be one of: {valid_classifications}"
            )

    return parsed


def _classify_batch_with_llm(
    existing_requirements: list[Requirement],
    new_items: list[MeetingItem],
    prompt_template: str,
    max_attempts: int
) -> list[dict[str, Any]]:
    """Classify multiple new items against existing requirements in a single LLM call.

    Args:
        existing_requirements: List of existing requirements to compare against.
        new_items: List of new meeting items to classify.
        prompt_template: The batch prompt template.
        max_attempts: Maximum number of retry attempts.

    Returns:
        A list of classification results for each item.

    Raises:
        ConflictDetectionError: If classification fails after all retries.
    """
    # Format existing requirements
    existing_formatted = "\n".join([
        f"[{i}] {req.content}"
        for i, req in enumerate(existing_requirements)
    ])
    
    # Format new items
    new_formatted = "\n".join([
        f"[{i}] {item.content}"
        for i, item in enumerate(new_items)
    ])
    
    prompt = prompt_template.replace("{existing_requirements}", existing_formatted)
    prompt = prompt.replace("{new_items}", new_formatted)
    
    last_error: Exception | None = None

    for attempt in range(max_attempts):
        try:
            provider = get_provider()
            response = provider.generate(prompt)
            result = _parse_batch_classification_response(response, len(new_items))
            return result

        except (ConflictDetectionError, LLMError) as e:
            last_error = e
            logger.warning(f"[Batch Classification] Attempt {attempt + 1} failed: {e}")
            if attempt >= max_attempts - 1:
                break
            continue
        except Exception as e:
            last_error = ConflictDetectionError(f"Unexpected error during batch classification: {e}")
            if attempt >= max_attempts - 1:
                break
            continue

    raise ConflictDetectionError(
        f"Batch classification failed after {max_attempts} attempts: {last_error}"
    )


def _classify_with_llm(
    existing_content: str,
    new_content: str,
    prompt_template: str,
    max_attempts: int
) -> dict[str, Any]:
    """Classify the relationship between existing requirement and new item using LLM.

    Args:
        existing_content: The content of the existing requirement.
        new_content: The content of the new meeting item.
        prompt_template: The prompt template with {existing_content} and {new_content} placeholders.
        max_attempts: Maximum number of retry attempts.

    Returns:
        A dictionary with 'classification' and 'reason' keys.

    Raises:
        ConflictDetectionError: If classification fails after all retries.
    """
    prompt = prompt_template.replace("{existing_content}", existing_content)
    prompt = prompt.replace("{new_content}", new_content)
    last_error: Exception | None = None

    for attempt in range(max_attempts):
        try:
            provider = get_provider()
            response = provider.generate(prompt)
            result = _parse_classification_response(response)
            return result

        except (ConflictDetectionError, LLMError) as e:
            last_error = e
            if attempt >= max_attempts - 1:
                break
            continue
        except Exception as e:
            last_error = ConflictDetectionError(f"Unexpected error during classification: {e}")
            if attempt >= max_attempts - 1:
                break
            continue

    raise ConflictDetectionError(
        f"Classification failed after {max_attempts} attempts: {last_error}"
    )


def detect_conflicts(meeting_id: UUID, db: Session) -> ConflictDetectionResult:
    """Detect duplicates and conflicts when applying meeting items to requirements.

    This function:
    1. Loads the meeting and its items from the database
    2. Loads all active requirements for the same project
    3. If no existing requirements, marks all items as "added" (fast path)
    4. For items with existing requirements in same section:
       - Checks for exact text match (skip as duplicate immediately)
       - Uses batch LLM classification for remaining items
    5. Returns categorized results: {added: [], skipped: [], conflicts: []}

    Args:
        meeting_id: The UUID of the meeting to process.
        db: Database session.

    Returns:
        ConflictDetectionResult with categorized items.

    Raises:
        ConflictDetectionError: If the meeting is not found or has wrong status.
    """
    # Load the meeting
    meeting = db.query(MeetingRecap).filter(MeetingRecap.id == str(meeting_id)).first()
    if not meeting:
        raise ConflictDetectionError(f"Meeting not found: {meeting_id}")

    if meeting.status != MeetingStatus.processed:
        raise ConflictDetectionError(
            f"Meeting must have status 'processed' to detect conflicts. "
            f"Current status: {meeting.status.value}"
        )

    # Load meeting items (excluding deleted ones)
    meeting_items = (
        db.query(MeetingItem)
        .filter(MeetingItem.meeting_id == str(meeting_id))
        .filter(MeetingItem.is_deleted == False)
        .order_by(MeetingItem.section, MeetingItem.order)
        .all()
    )

    logger.info(f"[Conflict Detection] Found {len(meeting_items)} meeting items for meeting {meeting_id}")

    if not meeting_items:
        logger.info("[Conflict Detection] No meeting items found, returning empty result")
        return ConflictDetectionResult()

    # Load all active requirements for the project
    project_id = meeting.project_id
    logger.info(f"[Conflict Detection] Loading requirements for project_id={project_id}")

    requirements = (
        db.query(Requirement)
        .filter(Requirement.project_id == project_id)
        .filter(Requirement.is_active == True)
        .all()
    )
    logger.info(f"[Conflict Detection] Found {len(requirements)} existing requirements")

    # OPTION 4: Fast path - if no existing requirements, mark all as "added"
    if not requirements:
        logger.info("[Conflict Detection] No existing requirements - marking all items as 'added' (fast path)")
        result = ConflictDetectionResult()
        for item in meeting_items:
            result.added.append(ConflictResult(
                item=item,
                decision="added",
                reason="No existing requirements in project",
                matched_requirement=None,
                classification="new"
            ))
        return result

    # Build lookup for quick exact match detection per section
    requirements_by_section: dict[Section, list[Requirement]] = {}
    requirement_contents_by_section: dict[Section, set[str]] = {}

    for req in requirements:
        section = req.section
        if section not in requirements_by_section:
            requirements_by_section[section] = []
            requirement_contents_by_section[section] = set()
        requirements_by_section[section].append(req)
        requirement_contents_by_section[section].add(req.content.strip())

    # Process items: first handle exact matches and items with no section requirements
    result = ConflictDetectionResult()
    items_needing_llm: dict[Section, list[MeetingItem]] = {}  # Group by section for batch processing

    for item in meeting_items:
        section = item.section
        item_content = item.content.strip()

        # Check for exact text match
        if section in requirement_contents_by_section:
            if item_content in requirement_contents_by_section[section]:
                # Find the matching requirement
                matched_req = None
                for req in requirements_by_section[section]:
                    if req.content.strip() == item_content:
                        matched_req = req
                        break

                result.skipped.append(ConflictResult(
                    item=item,
                    decision="skipped_duplicate",
                    reason="Exact text match with existing requirement",
                    matched_requirement=matched_req,
                    classification="duplicate"
                ))
                continue

        # If no requirements in this section, the item is new
        if section not in requirements_by_section or not requirements_by_section[section]:
            result.added.append(ConflictResult(
                item=item,
                decision="added",
                reason="No existing requirements in this section",
                matched_requirement=None,
                classification="new"
            ))
            continue

        # This item needs LLM classification - group by section
        if section not in items_needing_llm:
            items_needing_llm[section] = []
        items_needing_llm[section].append(item)

    # OPTION 1: Batch LLM classification for remaining items
    if items_needing_llm:
        batch_prompt_template = _load_batch_prompt()
        max_attempts = settings.LLM_MAX_RETRIES + 1

        for section, items in items_needing_llm.items():
            section_requirements = requirements_by_section[section]
            logger.info(f"[Conflict Detection] Batch classifying {len(items)} items against {len(section_requirements)} requirements in section {section}")

            # Process in batches
            for batch_start in range(0, len(items), BATCH_SIZE):
                batch_items = items[batch_start:batch_start + BATCH_SIZE]
                logger.info(f"[Conflict Detection] Processing batch of {len(batch_items)} items (starting at {batch_start})")

                try:
                    classifications = _classify_batch_with_llm(
                        section_requirements,
                        batch_items,
                        batch_prompt_template,
                        max_attempts
                    )

                    # Process classification results
                    classifications_by_index = {c["item_index"]: c for c in classifications}

                    for i, item in enumerate(batch_items):
                        classification_data = classifications_by_index.get(i)

                        if not classification_data:
                            # Item wasn't classified - treat as new
                            result.added.append(ConflictResult(
                                item=item,
                                decision="added",
                                reason="No classification returned",
                                matched_requirement=None,
                                classification="new"
                            ))
                            continue

                        classification = classification_data.get("classification", "new")
                        reason = classification_data.get("reason", "")
                        matched_req_index = classification_data.get("matched_requirement_index")

                        # Get matched requirement if index provided
                        matched_req = None
                        if matched_req_index is not None and 0 <= matched_req_index < len(section_requirements):
                            matched_req = section_requirements[matched_req_index]

                        if classification == "duplicate":
                            result.skipped.append(ConflictResult(
                                item=item,
                                decision="skipped_semantic",
                                reason=reason,
                                matched_requirement=matched_req,
                                classification="duplicate"
                            ))
                        elif classification in ("refinement", "contradiction"):
                            result.conflicts.append(ConflictResult(
                                item=item,
                                decision="conflict",
                                reason=reason,
                                matched_requirement=matched_req,
                                classification=classification
                            ))
                        else:  # "new"
                            result.added.append(ConflictResult(
                                item=item,
                                decision="added",
                                reason=reason or "New requirement not related to existing requirements",
                                matched_requirement=None,
                                classification="new"
                            ))

                except ConflictDetectionError as e:
                    logger.warning(f"[Conflict Detection] Batch classification failed: {e}. Marking items as conflicts for manual review.")
                    # If batch classification fails, mark all items in batch as conflicts
                    for item in batch_items:
                        result.conflicts.append(ConflictResult(
                            item=item,
                            decision="conflict",
                            reason="Unable to automatically classify. Please review manually.",
                            matched_requirement=section_requirements[0] if section_requirements else None,
                            classification=None
                        ))

    logger.info(f"[Conflict Detection] Complete: {len(result.added)} added, {len(result.skipped)} skipped, {len(result.conflicts)} conflicts")
    return result
