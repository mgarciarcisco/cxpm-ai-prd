"""Chunking service for splitting long meeting notes into manageable pieces."""


def chunk_text(text: str, max_chars: int = 4000) -> list[str]:
    """
    Split text into chunks that fit within max_chars limit.

    Estimates tokens as characters / 4.
    Splits by double newlines (paragraphs) preserving boundaries.
    Keeps section headers (lines starting with # or ##) with each chunk for context.

    Args:
        text: The text to chunk
        max_chars: Maximum characters per chunk (default 4000, ~1000 tokens)

    Returns:
        List of text chunks
    """
    if not text or not text.strip():
        return []

    # If text fits in single chunk, return as-is
    if len(text) <= max_chars:
        return [text]

    # Extract section headers (lines starting with # or ##) for context
    lines = text.split("\n")
    section_headers: list[str] = []

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("#"):
            section_headers.append(line)

    # Split by double newlines to get paragraphs
    paragraphs = text.split("\n\n")

    chunks: list[str] = []
    current_chunk_parts: list[str] = []
    current_chunk_size = 0

    # Track the most recent section header seen
    current_section_header: str | None = None

    for paragraph in paragraphs:
        paragraph = paragraph.strip()
        if not paragraph:
            continue

        # Check if this paragraph contains a section header
        para_lines = paragraph.split("\n")
        for line in para_lines:
            stripped = line.strip()
            if stripped.startswith("#"):
                current_section_header = line
                break

        # Calculate size including separator
        para_size = len(paragraph)
        separator_size = 2 if current_chunk_parts else 0  # "\n\n" between paragraphs

        # Check if adding this paragraph would exceed the limit
        if current_chunk_size + separator_size + para_size > max_chars:
            # Save current chunk if it has content
            if current_chunk_parts:
                chunks.append("\n\n".join(current_chunk_parts))

            # Start new chunk, possibly with section header context
            if (
                current_section_header
                and not paragraph.strip().startswith("#")
                and current_section_header not in paragraph
            ):
                # Add section header for context if paragraph doesn't already have one
                current_chunk_parts = [current_section_header, paragraph]
                current_chunk_size = len(current_section_header) + 2 + para_size
            else:
                current_chunk_parts = [paragraph]
                current_chunk_size = para_size
        else:
            # Add paragraph to current chunk
            current_chunk_parts.append(paragraph)
            current_chunk_size += separator_size + para_size

    # Don't forget the last chunk
    if current_chunk_parts:
        chunks.append("\n\n".join(current_chunk_parts))

    return chunks
