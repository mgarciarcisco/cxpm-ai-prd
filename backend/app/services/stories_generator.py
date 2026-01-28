"""Stories Generator service for creating User Stories from requirements using LLM."""

import json
from collections.abc import AsyncIterator
from datetime import datetime
from pathlib import Path
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.exceptions import LLMResponseError, NoRequirementsError
from app.models import (
    Project,
    Requirement,
    StoryBatch,
    StoryBatchStatus,
    StoryFormat,
    StorySize,
    StoryStatus,
    UserStory,
)
from app.services.llm import LLMError, get_provider

# Path to the story prompt templates
PROMPTS_PATH = Path(__file__).parent.parent.parent / "prompts"
CLASSIC_PROMPT_PATH = PROMPTS_PATH / "generate_stories_classic_v1.txt"
JOB_STORY_PROMPT_PATH = PROMPTS_PATH / "generate_stories_job_v1.txt"

# LLM configuration for story generation
STORIES_LLM_TIMEOUT = 90  # seconds
STORIES_LLM_TEMPERATURE = 0.5
STORIES_LLM_MAX_TOKENS = 4000


def _parse_streaming_stories_json(accumulated: str) -> list[dict[str, Any]]:
    """Parse stories JSON incrementally from streaming LLM output.

    This function attempts to extract complete story objects from partially
    received JSON. It handles:
    - Markdown code block wrappers (```json ... ```)
    - Incomplete JSON (returns what's parseable so far)
    - Story extraction as each story object completes

    Args:
        accumulated: The accumulated text from the LLM stream so far.

    Returns:
        List of complete story dicts found so far. Only stories with
        required fields (title, description) are included.
    """
    # Strip any markdown code blocks that might be present
    cleaned = accumulated.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()

    # Must start with { for a valid JSON object
    if not cleaned.startswith("{"):
        return []

    stories: list[dict[str, Any]] = []

    # Find the start of the "stories" array
    stories_start = cleaned.find('"stories"')
    if stories_start == -1:
        return []

    # Find the opening bracket of the stories array
    array_start = cleaned.find("[", stories_start)
    if array_start == -1:
        return []

    # Parse story objects within the array
    # Track brace depth to find complete objects
    brace_count = 0
    in_string = False
    escape_next = False
    story_start = -1

    for i in range(array_start + 1, len(cleaned)):
        char = cleaned[i]

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

        if char == "{":
            if brace_count == 0:
                story_start = i
            brace_count += 1

        if char == "}":
            brace_count -= 1
            if brace_count == 0 and story_start != -1:
                # We have a complete story object
                story_str = cleaned[story_start : i + 1]
                try:
                    story = json.loads(story_str)
                    # Validate required fields
                    if (
                        isinstance(story, dict)
                        and "title" in story
                        and "description" in story
                    ):
                        stories.append(story)
                except json.JSONDecodeError:
                    pass  # Incomplete or malformed story, skip
                story_start = -1

    return stories


class StoriesGenerator:
    """Service for generating User Stories from requirements using LLM.

    This service handles:
    - Loading project requirements from the database
    - Building prompts based on format (classic vs job story)
    - Calling the LLM with the prompt
    - Parsing the LLM response into UserStory records
    - Creating stories with unique, never-reused story numbers
    """

    def __init__(self, db: Session):
        """Initialize the Stories generator.

        Args:
            db: Database session for querying and persisting data.
        """
        self.db = db

    def generate(
        self,
        batch: StoryBatch,
        created_by: str | None = None,
    ) -> list[UserStory]:
        """Generate user stories for a batch.

        This method:
        1. Loads project requirements from the database
        2. Builds the appropriate prompt based on format
        3. Calls the LLM to generate stories
        4. Parses the response and creates UserStory records

        Args:
            batch: The StoryBatch record containing generation settings.
            created_by: Optional user identifier for audit.

        Returns:
            List of created UserStory records.

        Raises:
            NoRequirementsError: If the project has no requirements.
            LLMResponseError: If the LLM response is malformed.
            LLMError: If the LLM call fails.
        """
        # Load requirements, optionally filtering by section
        requirements_by_section = self._load_requirements(
            batch.project_id,
            section_filter=batch.section_filter,
        )

        if not requirements_by_section:
            raise NoRequirementsError(batch.project_id)

        # Build the prompt
        prompt = self._build_prompt(batch.format, requirements_by_section)

        # Call the LLM with stories-specific configuration
        provider = get_provider()
        try:
            response = provider.generate(
                prompt,
                temperature=STORIES_LLM_TEMPERATURE,
                max_tokens=STORIES_LLM_MAX_TOKENS,
                timeout=STORIES_LLM_TIMEOUT,
            )
        except LLMError:
            raise

        # Parse the response
        stories_data = self._parse_response(response)

        # Reserve all story numbers atomically BEFORE the loop
        # This acquires a row-level lock on the Project that is held until commit
        # Prevents concurrent generations from getting overlapping story numbers
        story_numbers = self._reserve_story_numbers(batch.project_id, len(stories_data))

        # Create UserStory records using the reserved story numbers
        created_stories: list[UserStory] = []
        for i, story_data in enumerate(stories_data):
            story_number = story_numbers[i]

            # Map suggested_size to StorySize enum
            size = self._map_size(story_data.get("suggested_size"))

            story = UserStory(
                project_id=batch.project_id,
                batch_id=batch.id,
                story_number=story_number,
                format=batch.format,
                title=story_data.get("title", f"Story {story_number}"),
                description=story_data.get("description", ""),
                acceptance_criteria=story_data.get("acceptance_criteria", []),
                order=i,
                labels=story_data.get("suggested_labels", []),
                size=size,
                requirement_ids=story_data.get("source_requirement_ids", []),
                status=StoryStatus.DRAFT,
                created_by=created_by,
                updated_by=created_by,
            )
            self.db.add(story)
            created_stories.append(story)

        # Commit releases the lock acquired by _reserve_story_numbers
        self.db.commit()

        # Refresh all stories to get generated IDs
        for story in created_stories:
            self.db.refresh(story)

        return created_stories

    async def generate_stream(
        self,
        project_id: str,
        format: StoryFormat,
        section_filter: list[str] | None = None,
        created_by: str | None = None,
    ) -> AsyncIterator[dict[str, Any]]:
        """Stream user story generation story by story.

        This async generator:
        1. Loads project requirements from the database
        2. Builds the appropriate prompt based on format
        3. Streams the LLM response
        4. Yields stories as they are parsed
        5. Creates the batch and story records after all stories are received

        Args:
            project_id: The UUID of the project to generate stories for.
            format: The story format (CLASSIC or JOB_STORY).
            section_filter: Optional list of section names to include.
            created_by: Optional user identifier for audit.

        Yields:
            Dictionaries with event type and data:
            - {"type": "story", "title": "...", "description": "...", ...}

        Raises:
            NoRequirementsError: If the project has no requirements.
            LLMResponseError: If the LLM response is malformed.
            LLMError: If the LLM call fails.
        """
        # Load requirements
        requirements_by_section = self._load_requirements(
            project_id,
            section_filter=section_filter,
        )

        if not requirements_by_section:
            raise NoRequirementsError(project_id)

        # Build the prompt
        prompt = self._build_prompt(format, requirements_by_section)

        # Stream from the LLM
        provider = get_provider()
        accumulated = ""
        yielded_stories: set[str] = set()  # Track by title to avoid duplicates
        all_stories: list[dict[str, Any]] = []

        async for chunk in provider.stream(prompt):
            accumulated += chunk

            # Try to parse complete stories from accumulated text
            parsed_stories = _parse_streaming_stories_json(accumulated)

            # Yield any new stories we haven't yielded yet
            for story in parsed_stories:
                story_title = story.get("title", "")
                if story_title and story_title not in yielded_stories:
                    yielded_stories.add(story_title)
                    all_stories.append(story)
                    yield {
                        "type": "story",
                        "title": story["title"],
                        "description": story.get("description", ""),
                        "acceptance_criteria": story.get("acceptance_criteria", []),
                        "suggested_size": story.get("suggested_size"),
                        "suggested_labels": story.get("suggested_labels", []),
                        "source_requirement_ids": story.get("source_requirement_ids", []),
                    }

        # Validate we got stories
        if not all_stories:
            raise LLMResponseError("LLM response 'stories' array is empty", raw_response=accumulated)

        # Create the batch record
        batch = StoryBatch(
            project_id=project_id,
            format=format,
            section_filter=section_filter,
            status=StoryBatchStatus.READY,
            story_count=len(all_stories),
            created_by=created_by,
        )
        self.db.add(batch)
        self.db.flush()  # Get the batch ID

        # Reserve story numbers atomically
        story_numbers = self._reserve_story_numbers(project_id, len(all_stories))

        # Create UserStory records
        for i, story_data in enumerate(all_stories):
            story_number = story_numbers[i]
            size = self._map_size(story_data.get("suggested_size"))

            story = UserStory(
                project_id=project_id,
                batch_id=batch.id,
                story_number=story_number,
                format=format,
                title=story_data.get("title", f"Story {story_number}"),
                description=story_data.get("description", ""),
                acceptance_criteria=story_data.get("acceptance_criteria", []),
                order=i,
                labels=story_data.get("suggested_labels", []),
                size=size,
                requirement_ids=story_data.get("source_requirement_ids", []),
                status=StoryStatus.DRAFT,
                created_by=created_by,
                updated_by=created_by,
            )
            self.db.add(story)

        # Commit everything
        self.db.commit()
        self.db.refresh(batch)

        # Auto-update project's stories_status based on stories state
        # Import locally to avoid circular imports
        from app.services.stage_status import update_stories_status
        update_stories_status(project_id, self.db)

        # Yield completion event
        yield {
            "type": "complete",
            "batch_id": str(batch.id),
            "story_count": len(all_stories),
        }

    def _load_requirements(
        self,
        project_id: str,
        section_filter: list[str] | None = None,
    ) -> dict[str, list[dict[str, Any]]]:
        """Load active requirements for a project, grouped by section.

        Args:
            project_id: The UUID of the project.
            section_filter: Optional list of section names to include.

        Returns:
            Dictionary mapping section names to lists of requirement data.
        """
        query = self.db.query(Requirement).filter(
            Requirement.project_id == project_id,
            Requirement.is_active == True,  # noqa: E712
        )

        # Apply section filter if provided
        if section_filter:
            query = query.filter(Requirement.section.in_(section_filter))

        requirements = query.order_by(Requirement.section, Requirement.order).all()

        result: dict[str, list[dict[str, Any]]] = {}
        for req in requirements:
            section_name = req.section.value
            if section_name not in result:
                result[section_name] = []
            result[section_name].append({
                "id": str(req.id),
                "content": req.content,
            })

        return result

    def _build_prompt(
        self,
        format: StoryFormat,
        requirements_by_section: dict[str, list[dict[str, Any]]],
    ) -> str:
        """Build the LLM prompt from template and requirements.

        Args:
            format: The story format (CLASSIC or JOB_STORY).
            requirements_by_section: Requirements grouped by section.

        Returns:
            The complete prompt string.

        Raises:
            LLMResponseError: If the prompt template cannot be loaded.
        """
        # Select the appropriate template
        template_path = (
            CLASSIC_PROMPT_PATH if format == StoryFormat.CLASSIC else JOB_STORY_PROMPT_PATH
        )

        try:
            template = template_path.read_text(encoding="utf-8")
        except Exception as e:
            raise LLMResponseError(f"Failed to load prompt template: {e}")

        # Format requirements for the prompt
        requirements_text = self._format_requirements(requirements_by_section)

        # Replace the placeholder
        prompt = template.replace("{requirements_by_section}", requirements_text)

        return prompt

    def _format_requirements(
        self,
        requirements_by_section: dict[str, list[dict[str, Any]]],
    ) -> str:
        """Format requirements into a string for the prompt.

        Args:
            requirements_by_section: Requirements grouped by section.

        Returns:
            Formatted string with all requirements including their IDs.
        """
        lines: list[str] = []

        # Map section enum values to display names
        section_display_names = {
            "problems": "Problems & Pain Points",
            "user_goals": "User Goals",
            "functional_requirements": "Functional Requirements",
            "data_needs": "Data Needs",
            "constraints": "Constraints",
            "non_goals": "Non-Goals",
            "risks_assumptions": "Risks & Assumptions",
            "open_questions": "Open Questions",
            "action_items": "Action Items",
        }

        for section_value, requirements in requirements_by_section.items():
            display_name = section_display_names.get(
                section_value, section_value.replace("_", " ").title()
            )
            lines.append(f"### {display_name}")
            lines.append("")
            for i, req in enumerate(requirements, 1):
                # Include requirement ID for traceability
                lines.append(f"{i}. [ID: {req['id']}] {req['content']}")
            lines.append("")

        return "\n".join(lines)

    def _parse_response(self, response: str) -> list[dict[str, Any]]:
        """Parse the LLM response into story data.

        Args:
            response: The raw LLM response string.

        Returns:
            List of story dictionaries.

        Raises:
            LLMResponseError: If the response is not valid JSON or has unexpected structure.
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
            raise LLMResponseError(f"Invalid JSON response from LLM: {e}", raw_response=response)

        if not isinstance(parsed, dict):
            raise LLMResponseError("LLM response must be a JSON object", raw_response=response)

        # Extract stories array
        stories = parsed.get("stories", [])
        if not isinstance(stories, list):
            raise LLMResponseError("LLM response 'stories' must be an array", raw_response=response)

        if not stories:
            raise LLMResponseError("LLM response 'stories' array is empty", raw_response=response)

        # Validate story structure
        for i, story in enumerate(stories):
            if not isinstance(story, dict):
                raise LLMResponseError(f"Story {i} is not a dictionary", raw_response=response)
            required_fields = ["title", "description"]
            for field in required_fields:
                if field not in story:
                    raise LLMResponseError(
                        f"Story {i} missing '{field}' field", raw_response=response
                    )

        return stories

    def _map_size(self, size_str: str | None) -> StorySize | None:
        """Map a size string to StorySize enum.

        Args:
            size_str: The size string from LLM response.

        Returns:
            StorySize enum value or None if invalid.
        """
        if not size_str:
            return None

        size_map = {
            "xs": StorySize.XS,
            "s": StorySize.S,
            "m": StorySize.M,
            "l": StorySize.L,
            "xl": StorySize.XL,
        }
        return size_map.get(size_str.lower())

    def _reserve_story_numbers(self, project_id: str, count: int) -> list[int]:
        """Reserve a batch of sequential story numbers for a project.

        Uses row-level locking on the Project row to prevent race conditions
        when multiple story generations are triggered concurrently. The lock
        is held until the caller commits the transaction, ensuring all stories
        in the batch get sequential numbers without gaps from concurrent requests.

        Story numbers are never reused, even for deleted stories.

        Args:
            project_id: The UUID of the project.
            count: Number of story numbers to reserve.

        Returns:
            List of sequential story numbers to use (e.g., [5, 6, 7] for count=3).
        """
        if count <= 0:
            return []

        # Use SELECT ... FOR UPDATE to lock the project row
        # This prevents concurrent story number assignment
        # The lock is held until the transaction commits
        project = (
            self.db.query(Project)
            .filter(Project.id == project_id)
            .with_for_update()
            .first()
        )

        if not project:
            # If project doesn't exist, start at 1
            # (though this shouldn't happen in practice)
            return list(range(1, count + 1))

        # Get the max story number for this project (including deleted stories)
        # We query all stories, not just active ones, to ensure numbers are never reused
        max_number = (
            self.db.query(func.max(UserStory.story_number))
            .filter(UserStory.project_id == project_id)
            .scalar()
        )

        start_number = (max_number or 0) + 1
        return list(range(start_number, start_number + count))


def generate_stories_task(
    db: Session,
    batch_id: str,
    created_by: str | None = None,
) -> None:
    """Background task for story generation.

    This function is designed to be called from FastAPI's BackgroundTasks.
    It handles the full lifecycle of story generation:
    1. Set status to GENERATING
    2. Check if cancelled before starting
    3. Call the stories generator
    4. Check if cancelled after LLM call
    5. Update batch status to READY or FAILED

    Args:
        db: Database session.
        batch_id: The UUID of the StoryBatch record.
        created_by: Optional user identifier for audit.
    """
    # Fetch the batch record
    batch = db.query(StoryBatch).filter(StoryBatch.id == batch_id).first()
    if not batch:
        return  # Batch was deleted, nothing to do

    # Check if already cancelled before starting
    if batch.status == StoryBatchStatus.CANCELLED:
        return

    # Update status to GENERATING
    batch.status = StoryBatchStatus.GENERATING
    db.commit()

    try:
        generator = StoriesGenerator(db)

        # Load requirements
        requirements_by_section = generator._load_requirements(
            batch.project_id,
            section_filter=batch.section_filter,
        )

        if not requirements_by_section:
            raise NoRequirementsError(batch.project_id)

        # Build the prompt
        prompt = generator._build_prompt(batch.format, requirements_by_section)

        # Check for cancellation before LLM call
        db.refresh(batch)
        if batch.status == StoryBatchStatus.CANCELLED:
            return

        # Call the LLM with stories-specific configuration
        provider = get_provider()
        response = provider.generate(
            prompt,
            temperature=STORIES_LLM_TEMPERATURE,
            max_tokens=STORIES_LLM_MAX_TOKENS,
            timeout=STORIES_LLM_TIMEOUT,
        )

        # Check for cancellation after LLM call
        db.refresh(batch)
        if batch.status == StoryBatchStatus.CANCELLED:
            return

        # Parse the response
        stories_data = generator._parse_response(response)

        # Reserve all story numbers atomically BEFORE the loop
        # This acquires a row-level lock on the Project that is held until commit
        # Prevents concurrent generations from getting overlapping story numbers
        story_numbers = generator._reserve_story_numbers(batch.project_id, len(stories_data))

        # Create UserStory records using the reserved story numbers
        for i, story_data in enumerate(stories_data):
            story_number = story_numbers[i]

            # Map suggested_size to StorySize enum
            size = generator._map_size(story_data.get("suggested_size"))

            story = UserStory(
                project_id=batch.project_id,
                batch_id=batch.id,
                story_number=story_number,
                format=batch.format,
                title=story_data.get("title", f"Story {story_number}"),
                description=story_data.get("description", ""),
                acceptance_criteria=story_data.get("acceptance_criteria", []),
                order=i,
                labels=story_data.get("suggested_labels", []),
                size=size,
                requirement_ids=story_data.get("source_requirement_ids", []),
                status=StoryStatus.DRAFT,
                created_by=created_by,
                updated_by=created_by,
            )
            db.add(story)

        # Update batch with story count and ready status
        batch.story_count = len(stories_data)
        batch.status = StoryBatchStatus.READY
        # Commit releases the lock acquired by _reserve_story_numbers
        db.commit()

        # Auto-update project's stories_status based on stories state
        # Import locally to avoid circular imports
        from app.services.stage_status import update_stories_status
        update_stories_status(batch.project_id, db)

    except NoRequirementsError as e:
        # Rollback any pending changes before recording error status
        # This ensures partial story creation is not persisted
        db.rollback()
        # Re-fetch the batch after rollback to attach it to the session
        batch = db.query(StoryBatch).filter(StoryBatch.id == batch_id).first()
        if batch:
            batch.status = StoryBatchStatus.FAILED
            batch.error_message = str(e)
            db.commit()

    except LLMResponseError as e:
        # Rollback any pending changes before recording error status
        db.rollback()
        batch = db.query(StoryBatch).filter(StoryBatch.id == batch_id).first()
        if batch:
            batch.status = StoryBatchStatus.FAILED
            batch.error_message = f"Failed to parse LLM response: {e}"
            db.commit()

    except LLMError as e:
        # Rollback any pending changes before recording error status
        db.rollback()
        batch = db.query(StoryBatch).filter(StoryBatch.id == batch_id).first()
        if batch:
            batch.status = StoryBatchStatus.FAILED
            batch.error_message = f"LLM error: {e}"
            db.commit()

    except Exception as e:
        # Rollback any pending changes before recording error status
        db.rollback()
        batch = db.query(StoryBatch).filter(StoryBatch.id == batch_id).first()
        if batch:
            batch.status = StoryBatchStatus.FAILED
            batch.error_message = f"Unexpected error: {e}"
            db.commit()
