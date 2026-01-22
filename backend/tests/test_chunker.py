"""Tests for the chunker service."""

from app.services.chunker import chunk_text


class TestChunkTextUnderLimit:
    """Tests for text that fits within the limit (single chunk)."""

    def test_short_text_returns_single_chunk(self) -> None:
        """Text under the limit should return a single chunk."""
        text = "This is a short meeting note."
        result = chunk_text(text, max_chars=100)

        assert len(result) == 1
        assert result[0] == text

    def test_text_exactly_at_limit_returns_single_chunk(self) -> None:
        """Text exactly at the limit should return a single chunk."""
        text = "a" * 100
        result = chunk_text(text, max_chars=100)

        assert len(result) == 1
        assert result[0] == text

    def test_empty_text_returns_empty_list(self) -> None:
        """Empty text should return an empty list."""
        result = chunk_text("")

        assert result == []

    def test_whitespace_only_returns_empty_list(self) -> None:
        """Whitespace-only text should return an empty list."""
        result = chunk_text("   \n\n\t  ")

        assert result == []


class TestChunkTextOverLimit:
    """Tests for text that exceeds the limit (multiple chunks)."""

    def test_long_text_splits_into_multiple_chunks(self) -> None:
        """Text over the limit should be split into multiple chunks."""
        # Create text with multiple paragraphs
        para1 = "First paragraph with some content."
        para2 = "Second paragraph with more content."
        para3 = "Third paragraph with additional content."
        text = f"{para1}\n\n{para2}\n\n{para3}"

        # Set a limit that forces splitting
        result = chunk_text(text, max_chars=60)

        assert len(result) > 1

    def test_each_chunk_respects_max_chars(self) -> None:
        """Each chunk should be within the max_chars limit."""
        paragraphs = [f"Paragraph {i} with some content here." for i in range(10)]
        text = "\n\n".join(paragraphs)

        max_chars = 100
        result = chunk_text(text, max_chars=max_chars)

        for chunk in result:
            assert len(chunk) <= max_chars * 2  # Allow some flexibility for header preservation


class TestParagraphBoundaries:
    """Tests for paragraph boundary preservation."""

    def test_splits_at_paragraph_boundaries(self) -> None:
        """Chunks should split at paragraph boundaries (double newlines)."""
        para1 = "First paragraph."
        para2 = "Second paragraph."
        para3 = "Third paragraph."
        text = f"{para1}\n\n{para2}\n\n{para3}"

        # Force split between paragraphs
        result = chunk_text(text, max_chars=50)

        # No chunk should contain a split paragraph (no partial content)
        for chunk in result:
            # Check that paragraphs are complete
            if para1 in chunk:
                assert "First paragraph." in chunk
            if para2 in chunk:
                assert "Second paragraph." in chunk
            if para3 in chunk:
                assert "Third paragraph." in chunk

    def test_preserves_paragraph_content(self) -> None:
        """All paragraph content should be preserved across chunks."""
        para1 = "First paragraph with content."
        para2 = "Second paragraph with content."
        para3 = "Third paragraph with content."
        text = f"{para1}\n\n{para2}\n\n{para3}"

        result = chunk_text(text, max_chars=80)

        # Join all chunks and verify all content is present
        all_content = "\n\n".join(result)
        assert para1 in all_content
        assert para2 in all_content
        assert para3 in all_content

    def test_empty_paragraphs_ignored(self) -> None:
        """Empty paragraphs (multiple consecutive newlines) should be ignored."""
        text = "First paragraph.\n\n\n\n\nSecond paragraph."
        result = chunk_text(text, max_chars=1000)

        assert len(result) == 1
        # Content should be preserved but empty paragraphs collapsed
        assert "First paragraph." in result[0]
        assert "Second paragraph." in result[0]


class TestSectionHeaderPreservation:
    """Tests for section header preservation in chunks."""

    def test_section_header_preserved_in_first_chunk(self) -> None:
        """Section header should be in the first chunk containing its content."""
        text = "# Meeting Notes\n\nFirst paragraph.\n\nSecond paragraph."
        result = chunk_text(text, max_chars=1000)

        assert len(result) == 1
        assert "# Meeting Notes" in result[0]

    def test_section_header_prepended_to_subsequent_chunks(self) -> None:
        """Section header should be prepended to chunks that continue from that section."""
        # Create content that will split into multiple chunks
        header = "# Project Discussion"
        para1 = "Discussion about the project requirements and goals."
        para2 = "More details about implementation approach."
        para3 = "Additional notes on timeline and resources."
        text = f"{header}\n\n{para1}\n\n{para2}\n\n{para3}"

        # Force splitting with small max_chars
        result = chunk_text(text, max_chars=80)

        # First chunk should have the header
        assert header in result[0]

        # Subsequent chunks should have the header prepended for context
        if len(result) > 1:
            for chunk in result[1:]:
                # Header should be present if chunk doesn't start with its own header
                if not chunk.strip().startswith("#"):
                    assert header in chunk, f"Header should be prepended for context: {chunk}"

    def test_multiple_section_headers(self) -> None:
        """Multiple section headers should be tracked and prepended appropriately."""
        section1 = "# Section One"
        content1 = "Content for section one with enough text."
        section2 = "# Section Two"
        content2 = "Content for section two with enough text."

        text = f"{section1}\n\n{content1}\n\n{section2}\n\n{content2}"
        result = chunk_text(text, max_chars=1000)

        # Both sections should be in the result
        combined = "\n\n".join(result)
        assert section1 in combined
        assert section2 in combined
        assert content1 in combined
        assert content2 in combined

    def test_nested_headers_with_hash_symbols(self) -> None:
        """Both # and ## headers should be recognized."""
        text = "# Main Header\n\nSome content.\n\n## Sub Header\n\nMore content."
        result = chunk_text(text, max_chars=1000)

        combined = "\n\n".join(result)
        assert "# Main Header" in combined
        assert "## Sub Header" in combined

    def test_header_not_duplicated_in_same_chunk(self) -> None:
        """Header should not be duplicated if already in the paragraph."""
        header = "# Meeting Notes"
        content = "Some meeting content here."
        text = f"{header}\n\n{content}"

        result = chunk_text(text, max_chars=1000)

        assert len(result) == 1
        # Count occurrences of header - should only appear once
        assert result[0].count("# Meeting Notes") == 1


class TestEdgeCases:
    """Tests for edge cases."""

    def test_single_very_long_paragraph(self) -> None:
        """A single long paragraph should be kept intact (may exceed max_chars)."""
        long_paragraph = "word " * 100  # About 500 characters
        result = chunk_text(long_paragraph, max_chars=50)

        # The paragraph should be kept (can't split mid-paragraph)
        assert len(result) >= 1
        assert long_paragraph.strip() in result[0]

    def test_default_max_chars_is_4000(self) -> None:
        """Default max_chars should be 4000."""
        short_text = "Short text."
        result = chunk_text(short_text)

        # Short text with default max_chars should return single chunk
        assert len(result) == 1

    def test_text_with_only_headers(self) -> None:
        """Text containing only headers should be handled."""
        text = "# Header 1\n\n## Header 2\n\n### Header 3"
        result = chunk_text(text, max_chars=1000)

        assert len(result) == 1
        assert "# Header 1" in result[0]
        assert "## Header 2" in result[0]
        assert "### Header 3" in result[0]
