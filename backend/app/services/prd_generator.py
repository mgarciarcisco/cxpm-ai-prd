"""PRD Generator service for creating Product Requirements Documents using LLM."""

import asyncio
import json
from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.exceptions import GenerationCancelledError, LLMResponseError, NoRequirementsError
from app.models import PRD, PRDMode, PRDStatus, Project, Requirement
from app.services.llm import LLMError, get_provider

# Path to the PRD prompt templates
PROMPTS_PATH = Path(__file__).parent.parent.parent / "prompts"
DRAFT_PROMPT_PATH = PROMPTS_PATH / "generate_prd_draft_v1.txt"
DETAILED_PROMPT_PATH = PROMPTS_PATH / "generate_prd_detailed_v1.txt"
SECTIONS_PROMPTS_PATH = PROMPTS_PATH / "sections"

# LLM configuration for PRD generation
# Note: These would ideally be in config, but providers currently have fixed settings
PRD_LLM_TIMEOUT = 300  # seconds (5 min for local Ollama models)
PRD_LLM_TEMPERATURE = 0.7
PRD_LLM_MAX_TOKENS = 8000

# Timeouts for staged generation (per section)
STAGE_1_TIMEOUT = 60  # Sequential sections, user watching
STAGE_2_TIMEOUT = 90  # Parallel sections, more tolerance
STAGE_3_TIMEOUT = 45  # Executive summary, shorter output


@dataclass
class SectionConfig:
    """Configuration for a PRD section."""
    id: str
    title: str
    order: int
    stage: int  # 1, 2, or 3


# Section configurations for DETAILED mode (12 sections)
DETAILED_SECTIONS: list[SectionConfig] = [
    # Stage 1: Sequential, establishes core context
    SectionConfig(id="problem_statement", title="Problem Statement", order=2, stage=1),
    SectionConfig(id="goals_and_objectives", title="Goals and Objectives", order=3, stage=1),
    SectionConfig(id="target_users", title="Target Users", order=4, stage=1),
    SectionConfig(id="proposed_solution", title="Proposed Solution", order=5, stage=1),
    # Stage 2: Parallel, independent given Stage 1 context
    SectionConfig(id="functional_requirements", title="Functional Requirements", order=6, stage=2),
    SectionConfig(id="non_functional_requirements", title="Non-Functional Requirements", order=7, stage=2),
    SectionConfig(id="technical_considerations", title="Technical Considerations", order=8, stage=2),
    SectionConfig(id="success_metrics", title="Success Metrics", order=9, stage=2),
    SectionConfig(id="timeline_and_milestones", title="Timeline and Milestones", order=10, stage=2),
    SectionConfig(id="risks_and_mitigations", title="Risks and Mitigations", order=11, stage=2),
    SectionConfig(id="appendix", title="Appendix", order=12, stage=2),
    # Stage 3: Executive summary (uses all sections)
    SectionConfig(id="executive_summary", title="Executive Summary", order=1, stage=3),
]

# Section configurations for DRAFT mode (7 sections)
DRAFT_SECTIONS: list[SectionConfig] = [
    # Stage 1: Sequential, establishes core context
    SectionConfig(id="problem_statement", title="Problem Statement", order=2, stage=1),
    SectionConfig(id="goals_and_objectives", title="Goals and Objectives", order=3, stage=1),
    SectionConfig(id="proposed_solution", title="Proposed Solution", order=4, stage=1),
    # Stage 2: Parallel, DRAFT-specific sections
    SectionConfig(id="open_questions", title="Open Questions", order=5, stage=2),
    SectionConfig(id="identified_gaps", title="Identified Gaps", order=6, stage=2),
    SectionConfig(id="next_steps", title="Next Steps", order=7, stage=2),
    # Stage 3: Executive summary (uses all sections)
    SectionConfig(id="executive_summary", title="Executive Summary", order=1, stage=3),
]


def get_sections_for_mode(mode: PRDMode) -> list[SectionConfig]:
    """Get section configurations for the given mode."""
    return DETAILED_SECTIONS if mode == PRDMode.DETAILED else DRAFT_SECTIONS


def get_stage_sections(sections: list[SectionConfig], stage: int) -> list[SectionConfig]:
    """Get sections for a specific stage."""
    return [s for s in sections if s.stage == stage]


def get_section_by_id(sections: list[SectionConfig], section_id: str) -> SectionConfig | None:
    """Get a section config by its ID."""
    for s in sections:
        if s.id == section_id:
            return s
    return None


def _parse_streaming_prd_json(
    accumulated: str,
) -> tuple[str | None, list[dict[str, Any]]]:
    """Parse PRD JSON incrementally from streaming LLM output.

    This function attempts to extract the title and complete sections
    from partially received JSON. It handles:
    - Markdown code block wrappers (```json ... ```)
    - Incomplete JSON (returns what's parseable so far)
    - Title extraction before sections are complete
    - Section extraction as each section object completes

    Args:
        accumulated: The accumulated text from the LLM stream so far.

    Returns:
        Tuple of (title or None, list of complete section dicts).
        Title is None if not yet found. Sections list contains only
        sections that have been fully received.
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
        return None, []

    title: str | None = None
    sections: list[dict[str, Any]] = []

    # Try to extract title first using a simple pattern match
    # Look for "title": "..." pattern
    title_match_start = cleaned.find('"title"')
    if title_match_start != -1:
        # Find the colon after "title"
        colon_pos = cleaned.find(":", title_match_start)
        if colon_pos != -1:
            # Find the opening quote of the value
            quote_start = cleaned.find('"', colon_pos + 1)
            if quote_start != -1:
                # Find the closing quote (handling escapes)
                i = quote_start + 1
                while i < len(cleaned):
                    if cleaned[i] == "\\" and i + 1 < len(cleaned):
                        i += 2  # Skip escaped character
                        continue
                    if cleaned[i] == '"':
                        # Found closing quote
                        title = cleaned[quote_start + 1 : i]
                        # Unescape common sequences
                        title = title.replace('\\"', '"').replace("\\n", "\n")
                        break
                    i += 1

    # Now try to parse sections from the "sections" array
    sections_start = cleaned.find('"sections"')
    if sections_start == -1:
        return title, []

    # Find the opening bracket of the sections array
    array_start = cleaned.find("[", sections_start)
    if array_start == -1:
        return title, []

    # Parse section objects within the array
    # Track brace depth to find complete objects
    brace_count = 0
    in_string = False
    escape_next = False
    section_start = -1

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
                section_start = i
            brace_count += 1

        if char == "}":
            brace_count -= 1
            if brace_count == 0 and section_start != -1:
                # We have a complete section object
                section_str = cleaned[section_start : i + 1]
                try:
                    section = json.loads(section_str)
                    if (
                        isinstance(section, dict)
                        and "id" in section
                        and "title" in section
                        and "content" in section
                    ):
                        sections.append(section)
                except json.JSONDecodeError:
                    pass  # Incomplete or malformed section, skip
                section_start = -1

    return title, sections


class PRDGenerator:
    """Service for generating Product Requirements Documents using LLM.

    This service handles:
    - Loading project requirements from the database
    - Building prompts based on mode (draft vs detailed)
    - Calling the LLM with the prompt
    - Parsing the LLM response into structured sections
    - Creating PRD records with proper version tracking
    """

    def __init__(self, db: Session):
        """Initialize the PRD generator.

        Args:
            db: Database session for querying and persisting data.
        """
        self.db = db

    def generate(
        self,
        project_id: str,
        mode: PRDMode,
        created_by: str | None = None,
    ) -> PRD:
        """Generate a PRD for a project.

        This method:
        1. Loads project requirements from the database
        2. Builds the appropriate prompt based on mode
        3. Calls the LLM to generate PRD content
        4. Creates a PRD record with atomically assigned version

        Args:
            project_id: The UUID of the project to generate PRD for.
            mode: The generation mode (DRAFT or DETAILED).
            created_by: Optional user identifier for audit.

        Returns:
            The created PRD record.

        Raises:
            NoRequirementsError: If the project has no requirements.
            LLMResponseError: If the LLM response is malformed.
            LLMError: If the LLM call fails.
        """
        # Load requirements grouped by section
        requirements_by_section = self._load_requirements(project_id)

        if not requirements_by_section:
            raise NoRequirementsError(project_id)

        # Build the prompt
        prompt = self._build_prompt(mode, requirements_by_section)

        # Call the LLM with PRD-specific configuration
        provider = get_provider()
        try:
            response = provider.generate(
                prompt,
                temperature=PRD_LLM_TEMPERATURE,
                max_tokens=PRD_LLM_MAX_TOKENS,
                timeout=PRD_LLM_TIMEOUT,
            )
        except LLMError:
            raise

        # Parse the response
        title, sections, raw_markdown = self._parse_response(response)

        # Create PRD record first (version will be assigned atomically)
        prd = PRD(
            project_id=project_id,
            version=0,  # Placeholder - will be assigned atomically below
            title=None,  # Will be set atomically
            mode=mode,
            sections=None,  # Will be set atomically
            raw_markdown=None,  # Will be set atomically
            status=PRDStatus.GENERATING,  # Temporary status
            created_by=created_by,
            updated_by=created_by,
        )
        self.db.add(prd)
        self.db.flush()  # Get the ID without committing

        # Atomically assign version and update content
        # This locks the project row and ensures no duplicate versions
        self.assign_version_atomically(
            prd=prd,
            title=title,
            sections=sections,
            raw_markdown=raw_markdown,
            updated_by=created_by,
        )

        return prd

    def _load_requirements(self, project_id: str) -> dict[str, list[str]]:
        """Load active requirements for a project, grouped by section.

        Args:
            project_id: The UUID of the project.

        Returns:
            Dictionary mapping section names to lists of requirement content.
        """
        requirements = (
            self.db.query(Requirement)
            .filter(
                Requirement.project_id == project_id,
                Requirement.is_active == True,  # noqa: E712
            )
            .order_by(Requirement.section, Requirement.order)
            .all()
        )

        result: dict[str, list[str]] = {}
        for req in requirements:
            section_name = req.section.value
            if section_name not in result:
                result[section_name] = []
            result[section_name].append(req.content)

        return result

    def _build_prompt(
        self,
        mode: PRDMode,
        requirements_by_section: dict[str, list[str]],
    ) -> str:
        """Build the LLM prompt from template and requirements.

        Args:
            mode: The generation mode (DRAFT or DETAILED).
            requirements_by_section: Requirements grouped by section.

        Returns:
            The complete prompt string.

        Raises:
            LLMResponseError: If the prompt template cannot be loaded.
        """
        # Select the appropriate template
        template_path = DRAFT_PROMPT_PATH if mode == PRDMode.DRAFT else DETAILED_PROMPT_PATH

        try:
            template = template_path.read_text(encoding="utf-8")
        except Exception as e:
            raise LLMResponseError(f"Failed to load prompt template: {e}")

        # Format requirements for the prompt
        requirements_text = self._format_requirements(requirements_by_section)

        # Replace the placeholder
        prompt = template.replace("{requirements_by_section}", requirements_text)

        return prompt

    def _format_requirements(self, requirements_by_section: dict[str, list[str]]) -> str:
        """Format requirements into a string for the prompt.

        Args:
            requirements_by_section: Requirements grouped by section.

        Returns:
            Formatted string with all requirements.
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

        for section_value, contents in requirements_by_section.items():
            display_name = section_display_names.get(section_value, section_value.replace("_", " ").title())
            lines.append(f"### {display_name}")
            lines.append("")
            for i, content in enumerate(contents, 1):
                lines.append(f"{i}. {content}")
            lines.append("")

        return "\n".join(lines)

    def _parse_response(self, response: str) -> tuple[str, list[dict[str, Any]], str]:
        """Parse the LLM response into structured data.

        Args:
            response: The raw LLM response string.

        Returns:
            Tuple of (title, sections list, raw markdown).

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

        # Extract title
        title = parsed.get("title", "")
        if not title:
            raise LLMResponseError("LLM response missing 'title' field", raw_response=response)

        # Extract sections
        sections = parsed.get("sections", [])
        if not isinstance(sections, list):
            raise LLMResponseError("LLM response 'sections' must be an array", raw_response=response)

        if not sections:
            raise LLMResponseError("LLM response 'sections' array is empty", raw_response=response)

        # Validate section structure
        for i, section in enumerate(sections):
            if not isinstance(section, dict):
                raise LLMResponseError(f"Section {i} is not a dictionary", raw_response=response)
            required_fields = ["id", "title", "content", "order"]
            for field in required_fields:
                if field not in section:
                    raise LLMResponseError(f"Section {i} missing '{field}' field", raw_response=response)

        # Generate raw markdown from sections
        raw_markdown = self._generate_markdown(title, sections)

        return title, sections, raw_markdown

    def _generate_markdown(self, title: str, sections: list[dict[str, Any]]) -> str:
        """Generate markdown from PRD title and sections.

        Args:
            title: The PRD title.
            sections: List of section dictionaries.

        Returns:
            The complete PRD as markdown.
        """
        lines: list[str] = []
        lines.append(f"# {title}")
        lines.append("")

        # Sort sections by order
        sorted_sections = sorted(sections, key=lambda s: s.get("order", 0))

        for section in sorted_sections:
            lines.append(f"## {section['title']}")
            lines.append("")
            lines.append(section["content"])
            lines.append("")

        return "\n".join(lines)

    async def generate_stream(
        self,
        project_id: str,
        mode: PRDMode,
        created_by: str | None = None,
    ) -> AsyncIterator[dict[str, Any]]:
        """Stream PRD generation section by section.

        This async generator:
        1. Loads project requirements from the database
        2. Builds the appropriate prompt based on mode
        3. Streams the LLM response
        4. Yields title and sections as they are parsed
        5. Creates the PRD record after all sections are received

        Args:
            project_id: The UUID of the project to generate PRD for.
            mode: The generation mode (DRAFT or DETAILED).
            created_by: Optional user identifier for audit.

        Yields:
            Dictionaries with event type and data:
            - {"type": "title", "title": "PRD: Feature Name"}
            - {"type": "section", "id": "...", "title": "...", "content": "...", "order": N}

        Raises:
            NoRequirementsError: If the project has no requirements.
            LLMResponseError: If the LLM response is malformed.
            LLMError: If the LLM call fails.
        """
        # Load requirements grouped by section
        requirements_by_section = self._load_requirements(project_id)

        if not requirements_by_section:
            raise NoRequirementsError(project_id)

        # Build the prompt
        prompt = self._build_prompt(mode, requirements_by_section)

        # Stream from the LLM
        provider = get_provider()
        accumulated = ""
        yielded_title = False
        yielded_sections: set[str] = set()  # Track section IDs we've already yielded
        all_sections: list[dict[str, Any]] = []
        title = ""

        async for chunk in provider.stream(prompt):
            accumulated += chunk

            # Try to parse title and sections from accumulated text
            parsed_title, parsed_sections = _parse_streaming_prd_json(accumulated)

            # Yield title if we found it and haven't yielded it yet
            if parsed_title and not yielded_title:
                title = parsed_title
                yielded_title = True
                yield {"type": "title", "title": title}

            # Yield any new sections we haven't yielded yet
            for section in parsed_sections:
                section_id = section.get("id", "")
                if section_id and section_id not in yielded_sections:
                    yielded_sections.add(section_id)
                    all_sections.append(section)
                    yield {
                        "type": "section",
                        "id": section["id"],
                        "title": section["title"],
                        "content": section["content"],
                        "order": section.get("order", len(all_sections)),
                    }

        # Validate we got a complete response
        if not title:
            raise LLMResponseError("LLM response missing 'title' field", raw_response=accumulated)

        if not all_sections:
            raise LLMResponseError("LLM response 'sections' array is empty", raw_response=accumulated)

        # Generate raw markdown
        raw_markdown = self._generate_markdown(title, all_sections)

        # Create PRD record with atomic version assignment
        prd = PRD(
            project_id=project_id,
            version=0,  # Placeholder - will be assigned atomically
            title=None,  # Will be set atomically
            mode=mode,
            sections=None,  # Will be set atomically
            raw_markdown=None,  # Will be set atomically
            status=PRDStatus.GENERATING,  # Temporary status
            created_by=created_by,
            updated_by=created_by,
        )
        self.db.add(prd)
        self.db.flush()  # Get the ID without committing

        # Atomically assign version and update content
        version = self.assign_version_atomically(
            prd=prd,
            title=title,
            sections=all_sections,
            raw_markdown=raw_markdown,
            updated_by=created_by,
        )

        # Yield completion event with PRD info
        yield {
            "type": "complete",
            "prd_id": str(prd.id),
            "version": version,
            "section_count": len(all_sections),
        }

    async def generate_stream_staged(
        self,
        project_id: str,
        mode: PRDMode,
        created_by: str | None = None,
        prd_id: str | None = None,
    ) -> AsyncIterator[dict[str, Any]]:
        """Stream PRD generation using staged approach for faster perceived response.

        This implements the section-by-section generation design:
        - Stage 1: Sequential streaming of core sections (problem, goals, users, solution)
        - Stage 2: Parallel generation of independent sections
        - Stage 3: Sequential streaming of executive summary (needs all other sections)

        Args:
            project_id: The UUID of the project to generate PRD for.
            mode: The generation mode (DRAFT or DETAILED).
            created_by: Optional user identifier for audit.
            prd_id: Optional existing PRD ID to update (for regeneration).

        Yields:
            Dictionaries with event type and data:
            - {"type": "stage", "stage": 1, "sections": ["problem_statement", ...]}
            - {"type": "chunk", "section_id": "...", "content": "..."}
            - {"type": "section_complete", "section_id": "...", "title": "...", "content": "...", "order": N}
            - {"type": "section_failed", "section_id": "...", "error": "..."}
            - {"type": "complete", "prd_id": "...", "version": N}
        """
        # Load requirements
        requirements_by_section = self._load_requirements(project_id)
        if not requirements_by_section:
            raise NoRequirementsError(project_id)

        requirements_text = self._format_requirements(requirements_by_section)

        # Get section config for mode
        sections_config = get_sections_for_mode(mode)
        total_sections = len(sections_config)

        # Track completed sections and their content
        completed_sections: dict[str, dict[str, Any]] = {}
        failed_sections: dict[str, str] = {}

        # Create or get PRD record
        if prd_id:
            prd = self.db.query(PRD).filter(PRD.id == prd_id).first()
            if not prd:
                raise LLMResponseError(f"PRD {prd_id} not found")
        else:
            # Use negative timestamp as temporary version to avoid unique constraint
            # The real version will be assigned atomically at completion
            import time
            temp_version = -int(time.time() * 1000) % 1000000  # Negative to avoid collision
            prd = PRD(
                project_id=project_id,
                version=temp_version,
                title=None,
                mode=mode,
                sections=None,
                raw_markdown=None,
                status=PRDStatus.GENERATING,
                sections_total=total_sections,
                sections_completed=0,
                current_stage=1,
                created_by=created_by,
                updated_by=created_by,
            )
            self.db.add(prd)
            self.db.flush()

        # Stage 1: Sequential streaming
        stage_1_sections = get_stage_sections(sections_config, 1)
        yield {"type": "stage", "stage": 1, "sections": [s.id for s in stage_1_sections]}

        prd.current_stage = 1
        self.db.commit()

        prior_context = ""
        for section_config in stage_1_sections:
            try:
                async for event in self._generate_section_stream(
                    section_config,
                    requirements_text,
                    prior_context,
                ):
                    yield event
                    if event["type"] == "section_complete":
                        completed_sections[section_config.id] = {
                            "id": section_config.id,
                            "title": section_config.title,
                            "content": event["content"],
                            "order": section_config.order,
                            "status": "completed",
                            "generated_at": datetime.utcnow().isoformat(),
                        }
                        # Add to context for next sections
                        prior_context += f"\n\n## {section_config.title}\n{event['content']}"

                        # Update progress
                        prd.sections_completed = len(completed_sections)
                        self.db.commit()

            except LLMError as e:
                failed_sections[section_config.id] = str(e)
                yield {
                    "type": "section_failed",
                    "section_id": section_config.id,
                    "error": str(e),
                }
                # Continue with partial context

        # Stage 2: Parallel generation
        stage_2_sections = get_stage_sections(sections_config, 2)
        if stage_2_sections:
            yield {"type": "stage", "stage": 2, "sections": [s.id for s in stage_2_sections]}

            prd.current_stage = 2
            self.db.commit()

            # Create tasks for parallel generation with section tracking
            async def generate_with_tracking(section_config: SectionConfig) -> tuple[str, str, SectionConfig]:
                """Wrapper that includes section_config in result for error tracking."""
                try:
                    section_id, content = await self._generate_section(
                        section_config, requirements_text, prior_context
                    )
                    return section_id, content, section_config
                except LLMError as e:
                    # Re-raise with section context
                    raise LLMError(f"{section_config.id}:{str(e)}")

            tasks = [
                generate_with_tracking(section_config)
                for section_config in stage_2_sections
            ]

            # Process as they complete
            for coro in asyncio.as_completed(tasks):
                try:
                    section_id, content, section_config = await coro
                    completed_sections[section_id] = {
                        "id": section_id,
                        "title": section_config.title,
                        "content": content,
                        "order": section_config.order,
                        "status": "completed",
                        "generated_at": datetime.utcnow().isoformat(),
                    }
                    yield {
                        "type": "section_complete",
                        "section_id": section_id,
                        "title": section_config.title,
                        "content": content,
                        "order": section_config.order,
                    }

                    # Update progress
                    prd.sections_completed = len(completed_sections)
                    self.db.commit()

                except LLMError as e:
                    # Parse section_id from prefixed error message
                    error_str = str(e)
                    if ":" in error_str:
                        section_id = error_str.split(":")[0]
                        error_msg = error_str[len(section_id) + 1:]
                    else:
                        section_id = "unknown"
                        error_msg = error_str

                    failed_sections[section_id] = error_msg
                    yield {
                        "type": "section_failed",
                        "section_id": section_id,
                        "error": error_msg,
                    }

        # Build full context for executive summary
        full_context = ""
        for section_config in sections_config:
            if section_config.id in completed_sections and section_config.stage != 3:
                full_context += f"\n\n## {section_config.title}\n{completed_sections[section_config.id]['content']}"

        # Stage 3: Executive Summary
        stage_3_sections = get_stage_sections(sections_config, 3)
        if stage_3_sections:
            yield {"type": "stage", "stage": 3, "sections": [s.id for s in stage_3_sections]}

            prd.current_stage = 3
            self.db.commit()

            for section_config in stage_3_sections:
                try:
                    async for event in self._generate_section_stream(
                        section_config,
                        requirements_text,
                        full_context,
                    ):
                        yield event
                        if event["type"] == "section_complete":
                            completed_sections[section_config.id] = {
                                "id": section_config.id,
                                "title": section_config.title,
                                "content": event["content"],
                                "order": section_config.order,
                                "status": "completed",
                                "generated_at": datetime.utcnow().isoformat(),
                            }
                            prd.sections_completed = len(completed_sections)
                            self.db.commit()

                except LLMError as e:
                    failed_sections[section_config.id] = str(e)
                    yield {
                        "type": "section_failed",
                        "section_id": section_config.id,
                        "error": str(e),
                    }

        # Finalize PRD
        # Sort sections by order and add status to failed ones
        final_sections = []
        for section_config in sorted(sections_config, key=lambda s: s.order):
            if section_config.id in completed_sections:
                final_sections.append(completed_sections[section_config.id])
            elif section_config.id in failed_sections:
                final_sections.append({
                    "id": section_config.id,
                    "title": section_config.title,
                    "content": "",
                    "order": section_config.order,
                    "status": "failed",
                    "error": failed_sections[section_config.id],
                })
            else:
                final_sections.append({
                    "id": section_config.id,
                    "title": section_config.title,
                    "content": "",
                    "order": section_config.order,
                    "status": "pending",
                })

        # Generate title from problem statement or first completed section
        title = self._generate_title_from_sections(completed_sections, mode)

        # Generate markdown
        raw_markdown = self._generate_markdown(title, [
            s for s in final_sections if s.get("status") == "completed"
        ])

        # Determine final status
        if len(failed_sections) == 0:
            final_status = PRDStatus.READY
        elif len(completed_sections) == 0:
            final_status = PRDStatus.FAILED
        else:
            final_status = PRDStatus.PARTIAL

        # Atomically assign version and finalize
        version = self.assign_version_atomically(
            prd=prd,
            title=title,
            sections=final_sections,
            raw_markdown=raw_markdown,
            updated_by=created_by,
            status=final_status,
        )

        yield {
            "type": "complete",
            "prd_id": str(prd.id),
            "version": version,
            "section_count": len(completed_sections),
            "failed_count": len(failed_sections),
            "status": final_status.value,
        }

    async def _generate_section_stream(
        self,
        section_config: SectionConfig,
        requirements_text: str,
        prior_context: str,
    ) -> AsyncIterator[dict[str, Any]]:
        """Stream generation of a single section.

        Args:
            section_config: Configuration for the section to generate.
            requirements_text: Formatted requirements string.
            prior_context: Previously generated sections as context.

        Yields:
            Chunk events and section_complete event.
        """
        prompt = self._build_section_prompt(section_config.id, requirements_text, prior_context)

        provider = get_provider()
        accumulated = ""

        async for chunk in provider.stream(prompt):
            accumulated += chunk
            yield {
                "type": "chunk",
                "section_id": section_config.id,
                "content": chunk,
            }

        # Parse the complete section
        content = self._parse_section_response(accumulated, section_config.id)

        yield {
            "type": "section_complete",
            "section_id": section_config.id,
            "title": section_config.title,
            "content": content,
            "order": section_config.order,
        }

    async def _generate_section(
        self,
        section_config: SectionConfig,
        requirements_text: str,
        prior_context: str,
    ) -> tuple[str, str]:
        """Generate a complete section (for parallel execution).

        Args:
            section_config: Configuration for the section to generate.
            requirements_text: Formatted requirements string.
            prior_context: Previously generated sections as context.

        Returns:
            Tuple of (section_id, content).
        """
        prompt = self._build_section_prompt(section_config.id, requirements_text, prior_context)

        provider = get_provider()
        accumulated = ""

        async for chunk in provider.stream(prompt):
            accumulated += chunk

        content = self._parse_section_response(accumulated, section_config.id)
        return section_config.id, content

    def _build_section_prompt(
        self,
        section_id: str,
        requirements_text: str,
        prior_context: str,
    ) -> str:
        """Build prompt for generating a single section.

        Args:
            section_id: The ID of the section to generate.
            requirements_text: Formatted requirements string.
            prior_context: Previously generated sections as context.

        Returns:
            The complete prompt string.
        """
        # Load shared context
        shared_context_path = SECTIONS_PROMPTS_PATH / "shared_context.txt"
        try:
            shared_context = shared_context_path.read_text(encoding="utf-8")
        except FileNotFoundError:
            shared_context = ""

        # Load section-specific prompt
        section_prompt_path = SECTIONS_PROMPTS_PATH / f"{section_id}.txt"
        try:
            section_prompt = section_prompt_path.read_text(encoding="utf-8")
        except FileNotFoundError:
            raise LLMResponseError(f"Prompt template not found for section: {section_id}")

        # Format prior context
        prior_context_section = ""
        if prior_context.strip():
            prior_context_section = f"""## Previously Generated Sections (for context)
{prior_context}
"""

        # Build the complete prompt
        prompt = f"""{shared_context}

{section_prompt.replace("{requirements}", requirements_text).replace("{prior_context}", prior_context_section)}
"""

        return prompt

    def _parse_section_response(self, response: str, section_id: str) -> str:
        """Parse a section response from the LLM.

        Args:
            response: The raw LLM response.
            section_id: The expected section ID.

        Returns:
            The section content.

        Raises:
            LLMResponseError: If parsing fails.
        """
        # Strip markdown code blocks
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
            # Try to extract content directly if JSON parsing fails
            # Sometimes LLM outputs just the content without JSON wrapper
            if len(cleaned) > 100:  # Assume it's content if long enough
                return cleaned
            raise LLMResponseError(f"Invalid JSON response for section {section_id}: {e}")

        if isinstance(parsed, dict):
            if "content" in parsed:
                return parsed["content"]
            # Maybe it's just the content object structure
            if "id" in parsed and "title" in parsed:
                return parsed.get("content", "")

        raise LLMResponseError(f"Unexpected response format for section {section_id}")

    def _generate_title_from_sections(
        self,
        completed_sections: dict[str, dict[str, Any]],
        mode: PRDMode,
    ) -> str:
        """Generate a PRD title from completed sections.

        Args:
            completed_sections: Dict of completed section data.
            mode: The generation mode.

        Returns:
            Generated title string.
        """
        import re

        # Try to extract from executive summary, problem statement, or proposed solution
        for section_id in ["executive_summary", "problem_statement", "proposed_solution"]:
            if section_id in completed_sections:
                content = completed_sections[section_id].get("content", "")

                # Try to extract bold text first (often the main topic)
                bold_matches = re.findall(r"\*\*([^*]+)\*\*", content)
                for match in bold_matches:
                    # Skip headings and generic phrases
                    if match.startswith("#") or len(match) < 10:
                        continue
                    # Take first meaningful bold text
                    title = match.strip()
                    # Truncate at first sentence or 80 chars
                    if "." in title:
                        title = title.split(".")[0]
                    title = title[:80]
                    if len(title) > 15:  # Must be reasonably descriptive
                        return f"PRD: {title}"

                # Try first non-heading line
                lines = content.split("\n")
                for line in lines:
                    line = line.strip()
                    # Skip empty lines, headings, and short lines
                    if not line or line.startswith("#") or len(line) < 20:
                        continue
                    # Clean up markdown
                    clean_line = re.sub(r"[*_`]", "", line)
                    # Take first sentence
                    if "." in clean_line:
                        clean_line = clean_line.split(".")[0]
                    clean_line = clean_line[:80].strip()
                    if len(clean_line) > 15:
                        return f"PRD: {clean_line}"

        # Fallback
        mode_label = "Draft" if mode == PRDMode.DRAFT else "Detailed"
        return f"PRD: {mode_label} Product Requirements Document"

    async def regenerate_section(
        self,
        prd_id: str,
        section_id: str,
        custom_instructions: str | None = None,
        updated_by: str | None = None,
    ) -> AsyncIterator[dict[str, Any]]:
        """Regenerate a single section of an existing PRD.

        Args:
            prd_id: The UUID of the PRD.
            section_id: The ID of the section to regenerate.
            custom_instructions: Optional custom instructions for regeneration.
            updated_by: Optional user identifier.

        Yields:
            Chunk events and section_complete event.
        """
        # Load the PRD
        prd = self.db.query(PRD).filter(PRD.id == prd_id).first()
        if not prd:
            raise LLMResponseError(f"PRD {prd_id} not found")

        # Get section config
        sections_config = get_sections_for_mode(prd.mode)
        section_config = get_section_by_id(sections_config, section_id)
        if not section_config:
            raise LLMResponseError(f"Section {section_id} not found in mode {prd.mode}")

        # Load requirements
        requirements_by_section = self._load_requirements(prd.project_id)
        requirements_text = self._format_requirements(requirements_by_section)

        # Build context from existing sections
        prior_context = ""
        existing_sections = prd.sections or []

        # For stages 2 and 3, include all stage 1 sections as context
        if section_config.stage >= 2:
            for s in existing_sections:
                s_config = get_section_by_id(sections_config, s.get("id", ""))
                if s_config and s_config.stage == 1 and s.get("status") == "completed":
                    prior_context += f"\n\n## {s.get('title', '')}\n{s.get('content', '')}"

        # For stage 3, also include stage 2 sections
        if section_config.stage == 3:
            for s in existing_sections:
                s_config = get_section_by_id(sections_config, s.get("id", ""))
                if s_config and s_config.stage == 2 and s.get("status") == "completed":
                    prior_context += f"\n\n## {s.get('title', '')}\n{s.get('content', '')}"

        # Build prompt with optional custom instructions
        prompt = self._build_section_prompt(section_id, requirements_text, prior_context)
        if custom_instructions:
            prompt += f"\n\n## Additional Instructions\n{custom_instructions}"

        provider = get_provider()
        accumulated = ""

        async for chunk in provider.stream(prompt):
            accumulated += chunk
            yield {
                "type": "chunk",
                "section_id": section_id,
                "content": chunk,
            }

        # Parse the response
        content = self._parse_section_response(accumulated, section_id)

        # Update the section in the PRD
        updated_sections = []
        section_found = False
        new_section_data = {
            "id": section_id,
            "title": section_config.title,
            "content": content,
            "order": section_config.order,
            "status": "completed",
            "generated_at": datetime.utcnow().isoformat(),
        }

        for s in existing_sections:
            if s.get("id") == section_id:
                updated_sections.append(new_section_data)
                section_found = True
            else:
                updated_sections.append(s)

        # If section wasn't found (e.g., was a failed section), add it
        if not section_found:
            updated_sections.append(new_section_data)
            # Sort by order to maintain correct sequence
            updated_sections.sort(key=lambda x: x.get("order", 0))

        # Update PRD status if this was the only failed section
        all_completed = all(s.get("status") == "completed" for s in updated_sections)
        if all_completed and prd.status == PRDStatus.PARTIAL:
            prd.status = PRDStatus.READY

        # Update PRD
        prd.sections = updated_sections
        prd.raw_markdown = self._generate_markdown(prd.title, [
            s for s in updated_sections if s.get("status") == "completed"
        ])
        prd.updated_by = updated_by
        prd.updated_at = datetime.utcnow()
        self.db.commit()

        # Find affected downstream sections
        affected_sections = []
        for s_config in sections_config:
            if s_config.stage > section_config.stage:
                affected_sections.append(s_config.id)

        yield {
            "type": "section_complete",
            "section_id": section_id,
            "title": section_config.title,
            "content": content,
            "order": section_config.order,
            "affected_sections": affected_sections,
        }

    def _get_next_version(self, project_id: str) -> int:
        """Get the next version number for a project's PRD.

        Uses row-level locking to prevent race conditions when multiple
        PRD generations are triggered concurrently.

        IMPORTANT: The lock acquired by with_for_update() is held until
        the transaction commits. Callers should ensure that the PRD record
        is updated with the version BEFORE committing to maintain atomicity.

        Args:
            project_id: The UUID of the project.

        Returns:
            The next version number (1 if no PRDs exist).
        """
        # Use SELECT ... FOR UPDATE to lock the project row
        # This prevents concurrent version assignment
        project = (
            self.db.query(Project)
            .filter(Project.id == project_id)
            .with_for_update()
            .first()
        )

        if not project:
            # If project doesn't exist, version will be 1
            # (though this shouldn't happen in practice)
            return 1

        # Get the max version for this project
        max_version = (
            self.db.query(func.max(PRD.version))
            .filter(PRD.project_id == project_id)
            .scalar()
        )

        return (max_version or 0) + 1

    def assign_version_atomically(
        self,
        prd: PRD,
        title: str,
        sections: list[dict[str, Any]],
        raw_markdown: str,
        updated_by: str | None = None,
        status: PRDStatus | None = None,
    ) -> int:
        """Atomically assign version and update PRD content in a single transaction.

        This method ensures that version assignment and PRD update happen
        atomically by:
        1. Acquiring a row-level lock on the Project (prevents concurrent access)
        2. Determining the next version number
        3. Updating the PRD with version and content

        The lock is held for the entire operation until the transaction commits,
        preventing concurrent version assignment for the same project.

        IMPORTANT: This method commits the transaction to release the lock
        and ensure atomicity. Do not call db.commit() again after this method.

        Args:
            prd: The PRD record to update.
            title: The PRD title.
            sections: The PRD sections.
            raw_markdown: The generated markdown content.
            updated_by: Optional user identifier.
            status: Optional status to set (defaults to READY).

        Returns:
            The assigned version number.
        """
        # Lock the project row - this prevents concurrent version assignment
        # The lock is held until the transaction commits
        project = (
            self.db.query(Project)
            .filter(Project.id == prd.project_id)
            .with_for_update()
            .first()
        )

        if not project:
            # Project was deleted - version will be 1
            next_version = 1
        else:
            # Get the max version for this project (only consider positive versions)
            # Negative versions are temporary placeholders used during staged generation
            max_version = (
                self.db.query(func.max(PRD.version))
                .filter(PRD.project_id == prd.project_id)
                .filter(PRD.version > 0)
                .scalar()
            )
            next_version = (max_version or 0) + 1

        # Assign version and update content atomically
        prd.version = next_version
        prd.title = title
        prd.sections = sections
        prd.raw_markdown = raw_markdown
        prd.status = status if status is not None else PRDStatus.READY
        prd.updated_by = updated_by
        prd.updated_at = datetime.utcnow()
        prd.current_stage = None  # Clear stage tracking

        # Commit to persist changes and release the lock
        # This ensures the version assignment is atomic
        self.db.commit()
        self.db.refresh(prd)

        # Auto-update project's prd_status based on PRD state
        # Import locally to avoid circular imports
        from app.services.stage_status import update_prd_status
        update_prd_status(str(prd.project_id), self.db)

        return next_version


def generate_prd_task(
    db: Session,
    prd_id: str,
    project_id: str,
    mode: PRDMode,
    created_by: str | None = None,
) -> None:
    """Background task for PRD generation.

    This function is designed to be called from FastAPI's BackgroundTasks.
    It handles the full lifecycle of PRD generation:
    1. Set status to GENERATING
    2. Check if cancelled before starting
    3. Call the PRD generator
    4. Check if cancelled after LLM call
    5. Update status to READY or FAILED

    Args:
        db: Database session.
        prd_id: The UUID of the PRD record to update.
        project_id: The UUID of the project.
        mode: The generation mode (DRAFT or DETAILED).
        created_by: Optional user identifier for audit.
    """
    # Fetch the existing PRD record
    prd = db.query(PRD).filter(PRD.id == prd_id).first()
    if not prd:
        return  # PRD was deleted, nothing to do

    # Check if already cancelled before starting
    if prd.status == PRDStatus.CANCELLED:
        return

    # Update status to GENERATING
    prd.status = PRDStatus.GENERATING
    db.commit()

    try:
        # Load requirements grouped by section
        generator = PRDGenerator(db)
        requirements_by_section = generator._load_requirements(project_id)

        if not requirements_by_section:
            raise NoRequirementsError(project_id)

        # Build the prompt
        prompt = generator._build_prompt(mode, requirements_by_section)

        # Check for cancellation before LLM call
        db.refresh(prd)
        if prd.status == PRDStatus.CANCELLED:
            return

        # Call the LLM with PRD-specific configuration
        provider = get_provider()
        response = provider.generate(
            prompt,
            temperature=PRD_LLM_TEMPERATURE,
            max_tokens=PRD_LLM_MAX_TOKENS,
            timeout=PRD_LLM_TIMEOUT,
        )

        # Check for cancellation after LLM call
        db.refresh(prd)
        if prd.status == PRDStatus.CANCELLED:
            return

        # Parse the response
        title, sections, raw_markdown = generator._parse_response(response)

        # Atomically assign version and update PRD content
        # This method locks the project row, assigns the next version,
        # updates all PRD fields, and commits in a single atomic transaction.
        # This prevents duplicate versions when multiple generations run concurrently.
        generator.assign_version_atomically(
            prd=prd,
            title=title,
            sections=sections,
            raw_markdown=raw_markdown,
            updated_by=created_by,
        )
        # Note: assign_version_atomically() already commits, so we're done here

    except NoRequirementsError as e:
        # Rollback any pending changes before recording error status
        # This ensures partial PRD data is not persisted
        db.rollback()
        # Re-fetch the PRD after rollback to attach it to the session
        prd = db.query(PRD).filter(PRD.id == prd_id).first()
        if prd:
            prd.status = PRDStatus.FAILED
            prd.error_message = str(e)
            prd.updated_at = datetime.utcnow()
            db.commit()

    except LLMResponseError as e:
        # Rollback any pending changes before recording error status
        db.rollback()
        prd = db.query(PRD).filter(PRD.id == prd_id).first()
        if prd:
            prd.status = PRDStatus.FAILED
            prd.error_message = f"Failed to parse LLM response: {e}"
            prd.updated_at = datetime.utcnow()
            db.commit()

    except LLMError as e:
        # Rollback any pending changes before recording error status
        db.rollback()
        prd = db.query(PRD).filter(PRD.id == prd_id).first()
        if prd:
            prd.status = PRDStatus.FAILED
            prd.error_message = f"LLM error: {e}"
            prd.updated_at = datetime.utcnow()
            db.commit()

    except GenerationCancelledError:
        # Already handled by status check
        pass

    except Exception as e:
        # Rollback any pending changes before recording error status
        db.rollback()
        prd = db.query(PRD).filter(PRD.id == prd_id).first()
        if prd:
            prd.status = PRDStatus.FAILED
            prd.error_message = f"Unexpected error: {e}"
            prd.updated_at = datetime.utcnow()
            db.commit()
