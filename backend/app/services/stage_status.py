"""Stage status auto-update utilities.

This module provides functions to automatically update project stage statuses
when content changes, ensuring the stage indicators stay in sync with actual content.
"""

from sqlalchemy.orm import Session

from app.models import (
    ExportStatus,
    MockupsStatus,
    PRD,
    PRDStatus,
    PRDStageStatus,
    Project,
    Requirement,
    RequirementsStatus,
    StoriesStatus,
    StoryBatch,
    StoryBatchStatus,
    UserStory,
)


def update_requirements_status(project_id: str, db: Session) -> RequirementsStatus:
    """Update requirements_status based on current active requirements count.

    - If no active requirements: 'empty'
    - If has active requirements: 'has_items' (unless already 'reviewed')

    Args:
        project_id: The project UUID.
        db: Database session.

    Returns:
        The new requirements status.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return RequirementsStatus.empty

    # Count active requirements for this project
    active_count = (
        db.query(Requirement)
        .filter(Requirement.project_id == project_id, Requirement.is_active == True)
        .count()
    )

    if active_count == 0:
        project.requirements_status = RequirementsStatus.empty
    elif project.requirements_status == RequirementsStatus.empty:
        # Only update to has_items if currently empty
        # Don't downgrade from 'reviewed' to 'has_items'
        project.requirements_status = RequirementsStatus.has_items

    db.commit()
    return project.requirements_status


def update_prd_status(project_id: str, db: Session) -> PRDStageStatus:
    """Update prd_status based on PRD state.

    - No PRDs or all failed: 'empty'
    - Has PRD with status READY: 'ready'
    - Has PRD generating or partial: 'draft'

    Args:
        project_id: The project UUID.
        db: Database session.

    Returns:
        The new PRD stage status.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return PRDStageStatus.empty

    # Find the latest PRD for this project (excluding deleted)
    latest_prd = (
        db.query(PRD)
        .filter(PRD.project_id == project_id, PRD.deleted_at.is_(None))
        .order_by(PRD.version.desc())
        .first()
    )

    if not latest_prd or latest_prd.status in (PRDStatus.FAILED, PRDStatus.CANCELLED):
        project.prd_status = PRDStageStatus.empty
    elif latest_prd.status == PRDStatus.READY:
        project.prd_status = PRDStageStatus.ready
    else:
        # QUEUED, GENERATING, PARTIAL, ARCHIVED - treat as draft
        project.prd_status = PRDStageStatus.draft

    db.commit()
    return project.prd_status


def update_stories_status(project_id: str, db: Session) -> StoriesStatus:
    """Update stories_status based on user stories state.

    - No stories: 'empty'
    - Has stories: 'generated' (unless already 'refined')

    Args:
        project_id: The project UUID.
        db: Database session.

    Returns:
        The new stories status.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return StoriesStatus.empty

    # Count non-deleted stories for this project
    story_count = (
        db.query(UserStory)
        .filter(UserStory.project_id == project_id, UserStory.deleted_at.is_(None))
        .count()
    )

    if story_count == 0:
        project.stories_status = StoriesStatus.empty
    elif project.stories_status == StoriesStatus.empty:
        # Only update to generated if currently empty
        # Don't downgrade from 'refined' to 'generated'
        project.stories_status = StoriesStatus.generated

    db.commit()
    return project.stories_status


def update_mockups_status(project_id: str, db: Session) -> MockupsStatus:
    """Update mockups_status based on mockups state.

    For now, this just sets to 'generated' when called.
    Will be expanded when mockups feature is implemented.

    Args:
        project_id: The project UUID.
        db: Database session.

    Returns:
        The new mockups status.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return MockupsStatus.empty

    # When mockups are generated, update status
    if project.mockups_status == MockupsStatus.empty:
        project.mockups_status = MockupsStatus.generated
        db.commit()

    return project.mockups_status


def update_export_status(project_id: str, db: Session) -> ExportStatus:
    """Update export_status to 'exported' on first export.

    Args:
        project_id: The project UUID.
        db: Database session.

    Returns:
        The new export status.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return ExportStatus.not_exported

    if project.export_status == ExportStatus.not_exported:
        project.export_status = ExportStatus.exported
        db.commit()

    return project.export_status
