"""Project CRUD API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Project
from app.schemas import ProjectCreate, ProjectUpdate, ProjectResponse

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(project: ProjectCreate, db: Session = Depends(get_db)) -> Project:
    """Create a new project."""
    db_project = Project(
        name=project.name,
        description=project.description,
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project


@router.get("", response_model=list[ProjectResponse])
def list_projects(db: Session = Depends(get_db)) -> list[Project]:
    """Get list of all projects."""
    return db.query(Project).all()


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(project_id: str, db: Session = Depends(get_db)) -> Project:
    """Get a single project by ID."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: str,
    project_update: ProjectUpdate,
    db: Session = Depends(get_db),
) -> Project:
    """Update an existing project."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    # Update only provided fields
    update_data = project_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)

    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: str, db: Session = Depends(get_db)) -> None:
    """Delete a project."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    db.delete(project)
    db.commit()
