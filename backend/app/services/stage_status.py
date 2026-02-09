"""Stage status auto-update utilities.

This module provides functions to automatically update project stage statuses
when content changes, ensuring the stage indicators stay in sync with actual content.
"""

from sqlalchemy.orm import Session

from app.models import (
    JiraStory,
    ExportStatus,
    MockupsStatus,
    PRDStageStatus,
    Project,
    Requirement,
    RequirementsStatus,
    StoriesStatus,
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

    PRD feature has been removed. This is a no-op stub kept for API compatibility.

    Args:
        project_id: The project UUID.
        db: Database session.

    Returns:
        The current PRD stage status (unchanged).
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return PRDStageStatus.empty
    return project.prd_status


def update_stories_status(project_id: str, db: Session) -> StoriesStatus:
    """Update stories_status based on Jira stories (epic stories) for this project.

    - No Jira stories: 'empty'
    - Has Jira stories: 'generated' (unless already 'refined')

    Args:
        project_id: The project UUID.
        db: Database session.

    Returns:
        The new stories status.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return StoriesStatus.empty

    story_count = (
        db.query(JiraStory)
        .filter(JiraStory.project_id == project_id)
        .count()
    )

    if story_count == 0:
        project.stories_status = StoriesStatus.empty
    elif project.stories_status == StoriesStatus.empty:
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
