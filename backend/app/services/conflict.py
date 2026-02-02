"""Conflict detection service for identifying duplicates and conflicts when applying meeting items."""

import json
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

# Path to the conflict classification prompt template
PROMPT_PATH = Path(__file__).parent.parent.parent / "prompts" / "classify_conflict_v1.txt"


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
    3. For each meeting item:
       - Checks for exact text match (skip as duplicate immediately)
       - For non-exact matches, calls LLM to classify the relationship
    4. Returns categorized results: {added: [], skipped: [], conflicts: []}

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

    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"[DEBUG Conflict] Found {len(meeting_items)} meeting items for meeting {meeting_id}")

    if not meeting_items:
        logger.info("[DEBUG Conflict] No meeting items found, returning empty result")
        return ConflictDetectionResult()

    # Load all active requirements for the project
    import logging
    logger = logging.getLogger(__name__)

    project_id = meeting.project_id
    logger.info(f"[DEBUG Conflict] Loading requirements for project_id={project_id}")

    requirements = (
        db.query(Requirement)
        .filter(Requirement.project_id == project_id)
        .filter(Requirement.is_active == True)
        .all()
    )
    logger.info(f"[DEBUG Conflict] Found {len(requirements)} existing requirements")

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

    # Load prompt template for LLM classification
    prompt_template = _load_prompt()
    max_attempts = settings.LLM_MAX_RETRIES + 1

    # Process each meeting item
    result = ConflictDetectionResult()

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

        # For non-exact matches, check against all requirements in the same section using LLM
        best_match: ConflictResult | None = None
        is_new = True

        for req in requirements_by_section[section]:
            try:
                classification_result = _classify_with_llm(
                    req.content,
                    item_content,
                    prompt_template,
                    max_attempts
                )

                classification = classification_result.get("classification", "new")
                reason = classification_result.get("reason", "")

                if classification == "duplicate":
                    # Skip as semantic duplicate
                    result.skipped.append(ConflictResult(
                        item=item,
                        decision="skipped_semantic",
                        reason=reason,
                        matched_requirement=req,
                        classification="duplicate"
                    ))
                    is_new = False
                    best_match = None  # Mark as handled
                    break

                elif classification in ("refinement", "contradiction"):
                    # This is a conflict that needs user resolution
                    result.conflicts.append(ConflictResult(
                        item=item,
                        decision="conflict",
                        reason=reason,
                        matched_requirement=req,
                        classification=classification
                    ))
                    is_new = False
                    best_match = None  # Mark as handled
                    break

                # If "new", continue checking other requirements
                # (the item might match with a different requirement)

            except ConflictDetectionError:
                # If LLM fails for this comparison, treat as potential conflict
                # to be safe (let user decide)
                result.conflicts.append(ConflictResult(
                    item=item,
                    decision="conflict",
                    reason="Unable to automatically classify. Please review manually.",
                    matched_requirement=req,
                    classification=None
                ))
                is_new = False
                best_match = None
                break

        # If we went through all requirements and none matched (all "new"), add the item
        if is_new and best_match is None:
            result.added.append(ConflictResult(
                item=item,
                decision="added",
                reason="New requirement not related to existing requirements",
                matched_requirement=None,
                classification="new"
            ))

    return result
