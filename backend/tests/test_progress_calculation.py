"""Tests for project progress calculation."""

from app.schemas.project import calculate_progress


def test_empty_project_has_zero_progress() -> None:
    """Test that a project with all empty statuses has 0% progress."""
    progress = calculate_progress(
        requirements_status="empty",
        prd_status="empty",
        stories_status="empty",
        mockups_status="empty",
        export_status="not_exported",
    )
    assert progress == 0


def test_fully_complete_project_has_100_progress() -> None:
    """Test that a fully complete project has 100% progress."""
    progress = calculate_progress(
        requirements_status="reviewed",
        prd_status="ready",
        stories_status="refined",
        mockups_status="generated",
        export_status="exported",
    )
    assert progress == 100


def test_requirements_partial_credit() -> None:
    """Test that requirements stage gives partial credit for has_items."""
    # has_items = 10%
    progress = calculate_progress(
        requirements_status="has_items",
        prd_status="empty",
        stories_status="empty",
        mockups_status="empty",
        export_status="not_exported",
    )
    assert progress == 10

    # reviewed = 20%
    progress = calculate_progress(
        requirements_status="reviewed",
        prd_status="empty",
        stories_status="empty",
        mockups_status="empty",
        export_status="not_exported",
    )
    assert progress == 20


def test_prd_partial_credit() -> None:
    """Test that PRD stage gives partial credit for draft."""
    # draft = 10%
    progress = calculate_progress(
        requirements_status="empty",
        prd_status="draft",
        stories_status="empty",
        mockups_status="empty",
        export_status="not_exported",
    )
    assert progress == 10

    # ready = 20%
    progress = calculate_progress(
        requirements_status="empty",
        prd_status="ready",
        stories_status="empty",
        mockups_status="empty",
        export_status="not_exported",
    )
    assert progress == 20


def test_stories_partial_credit() -> None:
    """Test that stories stage gives partial credit for generated."""
    # generated = 10%
    progress = calculate_progress(
        requirements_status="empty",
        prd_status="empty",
        stories_status="generated",
        mockups_status="empty",
        export_status="not_exported",
    )
    assert progress == 10

    # refined = 20%
    progress = calculate_progress(
        requirements_status="empty",
        prd_status="empty",
        stories_status="refined",
        mockups_status="empty",
        export_status="not_exported",
    )
    assert progress == 20


def test_mockups_contribution() -> None:
    """Test that mockups stage contributes 20% when generated."""
    progress = calculate_progress(
        requirements_status="empty",
        prd_status="empty",
        stories_status="empty",
        mockups_status="generated",
        export_status="not_exported",
    )
    assert progress == 20


def test_export_contribution() -> None:
    """Test that export stage contributes 20% when exported."""
    progress = calculate_progress(
        requirements_status="empty",
        prd_status="empty",
        stories_status="empty",
        mockups_status="empty",
        export_status="exported",
    )
    assert progress == 20


def test_mixed_progress() -> None:
    """Test various combinations of partial progress."""
    # Requirements reviewed (20%) + PRD draft (10%) = 30%
    progress = calculate_progress(
        requirements_status="reviewed",
        prd_status="draft",
        stories_status="empty",
        mockups_status="empty",
        export_status="not_exported",
    )
    assert progress == 30

    # Requirements has_items (10%) + Stories generated (10%) = 20%
    progress = calculate_progress(
        requirements_status="has_items",
        prd_status="empty",
        stories_status="generated",
        mockups_status="empty",
        export_status="not_exported",
    )
    assert progress == 20

    # All stages at partial: has_items (10%) + draft (10%) + generated (10%) = 30%
    progress = calculate_progress(
        requirements_status="has_items",
        prd_status="draft",
        stories_status="generated",
        mockups_status="empty",
        export_status="not_exported",
    )
    assert progress == 30
