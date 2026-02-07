"""Services package for business logic."""

from app.services.chunker import chunk_text
from app.services.conflict import ConflictDetectionError, ConflictDetectionResult, ConflictResult, detect_conflicts
from app.services.exporter import export_markdown
from app.services.extractor import ExtractionError, extract, extract_stream
from app.services.llm import LLMError, LLMProvider, get_provider
from app.services.merger import MergeError, suggest_merge
from app.services.parser import parse_file
from app.services.prd_generator import PRDGenerator, generate_prd_task
from app.services.stage_status import (
    update_export_status,
    update_mockups_status,
    update_prd_status,
    update_requirements_status,
    update_stories_status,
)

__all__ = [
    "parse_file",
    "LLMProvider",
    "LLMError",
    "get_provider",
    "extract",
    "extract_stream",
    "ExtractionError",
    "chunk_text",
    "export_markdown",
    "detect_conflicts",
    "ConflictDetectionError",
    "ConflictDetectionResult",
    "ConflictResult",
    "suggest_merge",
    "MergeError",
    # PRD Generation
    "PRDGenerator",
    "generate_prd_task",
    # Stage Status Updates
    "update_requirements_status",
    "update_prd_status",
    "update_stories_status",
    "update_mockups_status",
    "update_export_status",
]
