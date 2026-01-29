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


def test_each_stage_at_max_independently() -> None:
    """Test that each stage contributes exactly 20% when at max status."""
    # Requirements reviewed only
    assert calculate_progress(
        requirements_status="reviewed",
        prd_status="empty",
        stories_status="empty",
        mockups_status="empty",
        export_status="not_exported",
    ) == 20

    # PRD ready only
    assert calculate_progress(
        requirements_status="empty",
        prd_status="ready",
        stories_status="empty",
        mockups_status="empty",
        export_status="not_exported",
    ) == 20

    # Stories refined only
    assert calculate_progress(
        requirements_status="empty",
        prd_status="empty",
        stories_status="refined",
        mockups_status="empty",
        export_status="not_exported",
    ) == 20

    # Mockups generated only
    assert calculate_progress(
        requirements_status="empty",
        prd_status="empty",
        stories_status="empty",
        mockups_status="generated",
        export_status="not_exported",
    ) == 20

    # Export exported only
    assert calculate_progress(
        requirements_status="empty",
        prd_status="empty",
        stories_status="empty",
        mockups_status="empty",
        export_status="exported",
    ) == 20


def test_unknown_status_gives_no_credit() -> None:
    """Test that unknown/invalid status values give no progress credit."""
    # Unknown requirements status
    progress = calculate_progress(
        requirements_status="unknown",
        prd_status="empty",
        stories_status="empty",
        mockups_status="empty",
        export_status="not_exported",
    )
    assert progress == 0

    # Unknown PRD status
    progress = calculate_progress(
        requirements_status="empty",
        prd_status="unknown",
        stories_status="empty",
        mockups_status="empty",
        export_status="not_exported",
    )
    assert progress == 0

    # Unknown stories status
    progress = calculate_progress(
        requirements_status="empty",
        prd_status="empty",
        stories_status="unknown",
        mockups_status="empty",
        export_status="not_exported",
    )
    assert progress == 0

    # Unknown mockups status
    progress = calculate_progress(
        requirements_status="empty",
        prd_status="empty",
        stories_status="empty",
        mockups_status="unknown",
        export_status="not_exported",
    )
    assert progress == 0

    # Unknown export status
    progress = calculate_progress(
        requirements_status="empty",
        prd_status="empty",
        stories_status="empty",
        mockups_status="empty",
        export_status="unknown",
    )
    assert progress == 0


def test_all_stages_at_partial_credit() -> None:
    """Test all stages at intermediate (partial credit) status."""
    # Requirements has_items (10%) + PRD draft (10%) + Stories generated (10%)
    # Mockups and Export don't have intermediate statuses
    progress = calculate_progress(
        requirements_status="has_items",
        prd_status="draft",
        stories_status="generated",
        mockups_status="empty",
        export_status="not_exported",
    )
    assert progress == 30


def test_progress_cumulative() -> None:
    """Test that progress accumulates correctly across stages."""
    # Start with 0
    base = calculate_progress(
        requirements_status="empty",
        prd_status="empty",
        stories_status="empty",
        mockups_status="empty",
        export_status="not_exported",
    )
    assert base == 0

    # Add requirements has_items (+10)
    step1 = calculate_progress(
        requirements_status="has_items",
        prd_status="empty",
        stories_status="empty",
        mockups_status="empty",
        export_status="not_exported",
    )
    assert step1 == base + 10

    # Upgrade to reviewed (+10 more = 20 total for requirements)
    step2 = calculate_progress(
        requirements_status="reviewed",
        prd_status="empty",
        stories_status="empty",
        mockups_status="empty",
        export_status="not_exported",
    )
    assert step2 == 20

    # Add PRD draft (+10)
    step3 = calculate_progress(
        requirements_status="reviewed",
        prd_status="draft",
        stories_status="empty",
        mockups_status="empty",
        export_status="not_exported",
    )
    assert step3 == 30

    # Upgrade PRD to ready (+10 more = 40 total)
    step4 = calculate_progress(
        requirements_status="reviewed",
        prd_status="ready",
        stories_status="empty",
        mockups_status="empty",
        export_status="not_exported",
    )
    assert step4 == 40

    # Add stories generated (+10)
    step5 = calculate_progress(
        requirements_status="reviewed",
        prd_status="ready",
        stories_status="generated",
        mockups_status="empty",
        export_status="not_exported",
    )
    assert step5 == 50

    # Upgrade stories to refined (+10 more = 60 total)
    step6 = calculate_progress(
        requirements_status="reviewed",
        prd_status="ready",
        stories_status="refined",
        mockups_status="empty",
        export_status="not_exported",
    )
    assert step6 == 60

    # Add mockups generated (+20)
    step7 = calculate_progress(
        requirements_status="reviewed",
        prd_status="ready",
        stories_status="refined",
        mockups_status="generated",
        export_status="not_exported",
    )
    assert step7 == 80

    # Add export exported (+20 = 100 total)
    step8 = calculate_progress(
        requirements_status="reviewed",
        prd_status="ready",
        stories_status="refined",
        mockups_status="generated",
        export_status="exported",
    )
    assert step8 == 100


def test_halfway_progress() -> None:
    """Test combinations that result in exactly 50% progress."""
    # Requirements reviewed (20%) + PRD ready (20%) + Stories generated (10%)
    progress = calculate_progress(
        requirements_status="reviewed",
        prd_status="ready",
        stories_status="generated",
        mockups_status="empty",
        export_status="not_exported",
    )
    assert progress == 50

    # Requirements has_items (10%) + PRD ready (20%) + Mockups generated (20%)
    progress = calculate_progress(
        requirements_status="has_items",
        prd_status="ready",
        stories_status="empty",
        mockups_status="generated",
        export_status="not_exported",
    )
    assert progress == 50


def test_export_without_other_stages() -> None:
    """Test edge case where only export is complete (unlikely but valid)."""
    progress = calculate_progress(
        requirements_status="empty",
        prd_status="empty",
        stories_status="empty",
        mockups_status="empty",
        export_status="exported",
    )
    assert progress == 20


def test_late_stage_progress_without_early_stages() -> None:
    """Test that late stages can contribute even if early stages are empty."""
    # Only mockups and export complete (unlikely workflow, but valid)
    progress = calculate_progress(
        requirements_status="empty",
        prd_status="empty",
        stories_status="empty",
        mockups_status="generated",
        export_status="exported",
    )
    assert progress == 40

    # Only stories and export complete
    progress = calculate_progress(
        requirements_status="empty",
        prd_status="empty",
        stories_status="refined",
        mockups_status="empty",
        export_status="exported",
    )
    assert progress == 40
