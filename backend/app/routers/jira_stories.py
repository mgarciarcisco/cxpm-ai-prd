"""JIRA Stories API endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import JiraStory, Project
from app.schemas import (
    JiraStoriesSaveRequest,
    JiraStoriesSaveResponse,
    JiraStoryResponse,
)

router = APIRouter(prefix="/api/jira-stories", tags=["jira-stories"])


def _build_jira_story_response(story: JiraStory) -> JiraStoryResponse:
    """Build a JiraStoryResponse from a JiraStory model instance."""
    return JiraStoryResponse(
        id=str(story.id),
        project_id=str(story.project_id),
        title=story.title,
        description=story.description,
        problem_statement=story.problem_statement,
        target_user_roles=story.target_user_roles,
        data_sources=story.data_sources,
        business_rules=story.business_rules,
        response_example=story.response_example,
        acceptance_criteria=story.acceptance_criteria,
        reporter=story.reporter,
        notes=story.notes,
        parent_jira_id=story.parent_jira_id,
        created_at=story.created_at,
        updated_at=story.updated_at,
    )


@router.post("/save", response_model=JiraStoriesSaveResponse, status_code=status.HTTP_201_CREATED)
def save_jira_stories(
    request: JiraStoriesSaveRequest,
    db: Session = Depends(get_db),
) -> JiraStoriesSaveResponse:
    """
    Save multiple JIRA stories to the database.
    
    Each story will be assigned a unique UUID as its id.
    All stories will be associated with the specified project.
    """
    # Verify project exists
    try:
        project_uuid = UUID(request.project_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid project_id format: {request.project_id}",
        )
    
    project = db.query(Project).filter(Project.id == str(project_uuid)).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project not found: {request.project_id}",
        )
    
    if project.archived:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot save stories to archived project: {project.name}",
        )
    
    # Create JIRA story records
    saved_stories = []
    
    for epic_data in request.epics:
        story = JiraStory(
            project_id=str(project_uuid),
            title=epic_data.title,
            description=epic_data.description,
            problem_statement=epic_data.problem_statement,
            target_user_roles=epic_data.target_user_roles,
            data_sources=epic_data.data_sources,
            business_rules=epic_data.business_rules,
            response_example=epic_data.response_example,
            acceptance_criteria=epic_data.acceptance_criteria,
            reporter=epic_data.reporter,
            notes=epic_data.notes,
            parent_jira_id=epic_data.parent_jira_id,
        )
        db.add(story)
        saved_stories.append(story)
    
    # Commit all stories
    db.commit()
    
    # Refresh to get generated IDs and timestamps
    for story in saved_stories:
        db.refresh(story)
    
    return JiraStoriesSaveResponse(
        message=f"Successfully saved {len(saved_stories)} JIRA story(ies) to project '{project.name}'",
        saved_count=len(saved_stories),
        saved_stories=[_build_jira_story_response(story) for story in saved_stories],
    )


@router.get("/project/{project_id}", response_model=list[JiraStoryResponse])
def list_project_jira_stories(
    project_id: str,
    db: Session = Depends(get_db),
) -> list[JiraStoryResponse]:
    """
    List all JIRA stories for a specific project.
    """
    # Verify project exists
    try:
        project_uuid = UUID(project_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid project_id format: {project_id}",
        )
    
    project = db.query(Project).filter(Project.id == str(project_uuid)).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project not found: {project_id}",
        )
    
    # Query all stories for this project
    stories = (
        db.query(JiraStory)
        .filter(JiraStory.project_id == str(project_uuid))
        .order_by(JiraStory.created_at.desc())
        .all()
    )
    
    return [_build_jira_story_response(story) for story in stories]


@router.delete("/project/{project_id}")
def delete_project_jira_stories(
    project_id: str,
    db: Session = Depends(get_db),
) -> dict:
    """
    Delete all JIRA stories for a specific project.
    """
    # Verify project exists
    try:
        project_uuid = UUID(project_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid project_id format: {project_id}",
        )
    
    project = db.query(Project).filter(Project.id == str(project_uuid)).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project not found: {project_id}",
        )
    
    # Delete all stories for this project
    deleted_count = (
        db.query(JiraStory)
        .filter(JiraStory.project_id == str(project_uuid))
        .delete(synchronize_session=False)
    )
    
    db.commit()
    
    return {
        "message": f"Successfully deleted {deleted_count} JIRA story(ies) from project '{project.name}'",
        "deleted_count": deleted_count,
    }
