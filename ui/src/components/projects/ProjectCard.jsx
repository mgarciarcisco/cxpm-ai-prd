import React from 'react'
import { useNavigate } from 'react-router-dom'
import './ProjectCard.css'

/**
 * Default stage definitions for the mini stepper
 */
const DEFAULT_STAGES = [
  { id: 'requirements', label: 'Requirements' },
  { id: 'prd', label: 'PRD' },
  { id: 'stories', label: 'User Stories' },
  { id: 'mockups', label: 'Mockups' },
  { id: 'export', label: 'Export' },
];

/**
 * Maps stage status to a normalized status for display
 * @param {string} stageId - The stage identifier
 * @param {Object} project - The project with status fields
 * @returns {'empty' | 'in_progress' | 'complete'}
 */
function getStageStatus(stageId, project) {
  const statusMap = {
    requirements: {
      empty: 'empty',
      has_items: 'in_progress',
      reviewed: 'complete',
    },
    prd: {
      empty: 'empty',
      draft: 'in_progress',
      ready: 'complete',
    },
    stories: {
      empty: 'empty',
      generated: 'in_progress',
      refined: 'complete',
    },
    mockups: {
      empty: 'empty',
      generated: 'complete',
    },
    export: {
      not_exported: 'empty',
      exported: 'complete',
    },
  };

  const fieldMap = {
    requirements: 'requirements_status',
    prd: 'prd_status',
    stories: 'stories_status',
    mockups: 'mockups_status',
    export: 'export_status',
  };

  const fieldName = fieldMap[stageId];
  const rawStatus = project[fieldName] || 'empty';
  return statusMap[stageId]?.[rawStatus] || 'empty';
}

/**
 * Determines the current active stage based on project statuses
 * The current stage is the first incomplete stage, or the last stage if all complete
 * @param {Object} project - The project with status fields
 * @returns {Object} - { id, label } of current stage
 */
function getCurrentStage(project) {
  for (const stage of DEFAULT_STAGES) {
    const status = getStageStatus(stage.id, project);
    if (status !== 'complete') {
      return stage;
    }
  }
  // All stages complete, return last stage
  return DEFAULT_STAGES[DEFAULT_STAGES.length - 1];
}

/**
 * Returns the status indicator character based on stage status
 * @param {'empty' | 'in_progress' | 'complete'} status
 * @returns {string}
 */
function getStatusIndicator(status) {
  switch (status) {
    case 'complete':
      return '●';
    case 'in_progress':
      return '◐';
    case 'empty':
    default:
      return '○';
  }
}

/**
 * Formats a date as "Updated X ago"
 * @param {string|Date} dateString
 * @returns {string}
 */
function formatTimeAgo(dateString) {
  if (!dateString) return 'No activity yet';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffSeconds < 60) {
    return 'Updated just now';
  } else if (diffMinutes < 60) {
    return `Updated ${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `Updated ${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  } else if (diffDays < 7) {
    return `Updated ${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  } else if (diffWeeks < 4) {
    return `Updated ${diffWeeks} week${diffWeeks !== 1 ? 's' : ''} ago`;
  } else if (diffMonths < 12) {
    return `Updated ${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`;
  } else {
    return `Updated ${diffYears} year${diffYears !== 1 ? 's' : ''} ago`;
  }
}

/**
 * Mini stepper component showing stage progress as dots
 */
function MiniStepper({ project }) {
  return (
    <div className="project-card__mini-stepper" aria-label="Stage progress">
      {DEFAULT_STAGES.map((stage) => {
        const status = getStageStatus(stage.id, project);
        return (
          <span
            key={stage.id}
            className={`project-card__mini-stepper-dot project-card__mini-stepper-dot--${status}`}
            title={`${stage.label}: ${status.replace('_', ' ')}`}
            aria-label={`${stage.label}: ${status.replace('_', ' ')}`}
          >
            {getStatusIndicator(status)}
          </span>
        );
      })}
    </div>
  );
}

function ProjectCard({ project, meetingCount, lastActivity, onEdit, onDelete }) {
  const navigate = useNavigate()
  const currentStage = getCurrentStage(project);
  const progress = project.progress ?? 0;

  const handleCardClick = () => {
    navigate(`/projects/${project.id}`)
  }

  const handleEditClick = (e) => {
    e.stopPropagation()
    onEdit(project)
  }

  const handleDeleteClick = (e) => {
    e.stopPropagation()
    onDelete(project)
  }

  const isArchived = project.archived === true;

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleCardClick()
    }
  }

  return (
    <div
      className={`project-card${isArchived ? ' project-card--archived' : ''}`}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`Open project: ${project.name}`}
    >
      <div className="project-card__header">
        <div className="project-card__name-row">
          <h3 className="project-card__name">{project.name}</h3>
          {isArchived && (
            <span className="project-card__archived-badge" title="Archived">
              Archived
            </span>
          )}
        </div>
        <div className="project-card__actions">
          <button
            className="project-card__action-btn"
            onClick={handleEditClick}
            aria-label="Edit project"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M11.333 2.00001C11.5081 1.82491 11.7169 1.68602 11.9471 1.59126C12.1773 1.4965 12.4244 1.44772 12.674 1.44772C12.9237 1.44772 13.1707 1.4965 13.4009 1.59126C13.6311 1.68602 13.8399 1.82491 14.015 2.00001C14.1901 2.17511 14.329 2.38394 14.4238 2.61411C14.5185 2.84428 14.5673 3.09136 14.5673 3.34101C14.5673 3.59066 14.5185 3.83773 14.4238 4.0679C14.329 4.29808 14.1901 4.5069 14.015 4.68201L5.00001 13.697L1.33334 14.667L2.30334 11L11.333 2.00001Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button
            className="project-card__action-btn project-card__action-btn--delete"
            onClick={handleDeleteClick}
            aria-label="Delete project"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 4H3.33333H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M5.33334 4.00001V2.66668C5.33334 2.31305 5.47382 1.97392 5.72387 1.72387C5.97392 1.47382 6.31305 1.33334 6.66668 1.33334H9.33334C9.68697 1.33334 10.0261 1.47382 10.2762 1.72387C10.5262 1.97392 10.6667 2.31305 10.6667 2.66668V4.00001M12.6667 4.00001V13.3333C12.6667 13.687 12.5262 14.0261 12.2762 14.2762C12.0261 14.5262 11.687 14.6667 11.3333 14.6667H4.66668C4.31305 14.6667 3.97392 14.5262 3.72387 14.2762C3.47382 14.0261 3.33334 13.687 3.33334 13.3333V4.00001H12.6667Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      <p className="project-card__description">
        {project.description || 'No description'}
      </p>

      <div className="project-card__progress-section">
        <MiniStepper project={project} />
        <div className="project-card__progress-info">
          <span className="project-card__stage-badge">
            {currentStage.label}
          </span>
          <span className="project-card__progress-percent">
            {progress}%
          </span>
        </div>
      </div>

      <div className="project-card__footer">
        <div className="project-card__stat">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M11.667 2.33334H2.33366C1.59728 2.33334 1.00033 2.9303 1.00033 3.66668V11.6667C1.00033 12.4031 1.59728 13 2.33366 13H11.667C12.4034 13 13.0003 12.4031 13.0003 11.6667V3.66668C13.0003 2.9303 12.4034 2.33334 11.667 2.33334Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M9.66699 1V3.66667" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M4.33301 1V3.66667" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M1 6.33334H13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>{meetingCount ?? 0} meeting{meetingCount !== 1 ? 's' : ''}</span>
        </div>
        <div className="project-card__stat">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M7 3.66666V7L9 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>{formatTimeAgo(lastActivity || project.updated_at)}</span>
        </div>
      </div>
    </div>
  )
}

export default ProjectCard
