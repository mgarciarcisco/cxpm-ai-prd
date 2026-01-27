"""Services package for business logic."""

from app.services.chunker import chunk_text
from app.services.conflict import ConflictDetectionError, ConflictDetectionResult, ConflictResult, detect_conflicts
from app.services.exporter import export_markdown
from app.services.extractor import ExtractionError, extract, extract_stream
from app.services.llm import LLMError, LLMProvider, get_provider
from app.services.merger import MergeError, suggest_merge
from app.services.parser import parse_file
from app.services.prd_generator import PRDGenerator, generate_prd_task
from app.services.stories_generator import StoriesGenerator, generate_stories_task

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
    # Stories Generation
    "StoriesGenerator",
    "generate_stories_task",
]
