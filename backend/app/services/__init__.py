"""Services package for business logic."""

from app.services.parser import parse_file
from app.services.llm import LLMProvider, LLMError, get_provider
from app.services.extractor import extract, extract_stream, ExtractionError
from app.services.chunker import chunk_text
from app.services.exporter import export_markdown
from app.services.conflict import detect_conflicts, ConflictDetectionError, ConflictDetectionResult, ConflictResult

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
]
