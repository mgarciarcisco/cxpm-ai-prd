import React from 'react'
import { useNavigate } from 'react-router-dom'
import './ProjectCard.css'

/**
 * Stage definitions with action-oriented labels
 */
const STAGES = [
  { id: 'requirements', label: 'Gathering Requirements' },
  { id: 'prd', label: 'Writing Specification' },
  { id: 'stories', label: 'Breaking into Tasks' },
  { id: 'mockups', label: 'Designing Screens' },
  { id: 'export', label: 'Exporting & Sharing' },
];

/**
 * Maps stage status to a normalized status for display
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
 * Calculate progress info - completed count, active stage, etc.
 */
function getProgressInfo(project) {
  let completedCount = 0;
  let activeStageIndex = -1;
  let activeStageLabel = '';

  for (let i = 0; i < STAGES.length; i++) {
    const status = getStageStatus(STAGES[i].id, project);
    if (status === 'complete') {
      completedCount++;
    } else if (activeStageIndex === -1) {
      activeStageIndex = i;
      activeStageLabel = STAGES[i].label;
    }
  }

  const isComplete = completedCount === STAGES.length;
  if (isComplete) {
    activeStageIndex = -1;
    activeStageLabel = '';
  }

  const progressPercent = (completedCount / STAGES.length) * 100;
  // Add partial progress for active stage
  const activePercent = activeStageIndex >= 0 ? (1 / STAGES.length) * 100 : 0;

  return {
    completedCount,
    activeStageIndex,
    activeStageLabel,
    progressPercent,
    activePercent,
    isComplete,
    totalStages: STAGES.length,
  };
}

/**
 * Formats a date as "Updated X ago"
 */
function formatTimeAgo(dateString) {
  if (!dateString) return 'No activity yet';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  if (diffMs < 0) return 'Updated just now';
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffMinutes < 1) return 'Updated just now';
  if (diffMinutes < 60) return `Updated ${diffMinutes}m ago`;
  if (diffHours < 24) return `Updated ${diffHours}h ago`;
  if (diffDays < 7) return `Updated ${diffDays}d ago`;
  if (diffWeeks < 4) return `Updated ${diffWeeks}w ago`;
  if (diffMonths < 12) return `Updated ${diffMonths}mo ago`;
  return date.toLocaleDateString();
}

/**
 * Progress bar component with tooltip
 */
function ProgressBar({ progressPercent, activePercent, completedCount, activeStageLabel }) {
  const tooltipText = activeStageLabel
    ? `${completedCount} stage${completedCount !== 1 ? 's' : ''} completed • ${activeStageLabel} in progress`
    : `${completedCount} stage${completedCount !== 1 ? 's' : ''} completed`;

  return (
    <div className="project-card__progress-container">
      <div className="project-card__progress-bar" title={tooltipText}>
        <div
          className="project-card__progress-segment project-card__progress-segment--complete"
          style={{ width: `${progressPercent}%` }}
        />
        {activePercent > 0 && (
          <div
            className="project-card__progress-segment project-card__progress-segment--active"
            style={{ width: `${activePercent}%` }}
          />
        )}
      </div>
    </div>
  );
}

function ProjectCard({ project, lastActivity, onEdit, onDelete }) {
  const navigate = useNavigate()
  const progressInfo = getProgressInfo(project);
  const isArchived = project.archived === true;

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

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleCardClick()
    }
  }

  // Build the stage label
  let stageLabel;
  if (progressInfo.isComplete) {
    stageLabel = (
      <span className="project-card__stage-label project-card__stage-label--complete">
        <span className="project-card__stage-icon">✓</span>
        Complete
      </span>
    );
  } else {
    stageLabel = (
      <span className="project-card__stage-label project-card__stage-label--active">
        <span className="project-card__stage-step">
          Step {progressInfo.activeStageIndex + 1}/{progressInfo.totalStages}:
        </span>
        {progressInfo.activeStageLabel}
      </span>
    );
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
        <div className="project-card__title-section">
          <div className="project-card__name-row">
            <h3 className="project-card__name">{project.name}</h3>
            {isArchived && (
              <span className="project-card__archived-badge">Archived</span>
            )}
          </div>
          {project.description && (
            <p className="project-card__description">
              {project.description}
            </p>
          )}
        </div>
        <div className="project-card__meta">
          <span className="project-card__time">
            {formatTimeAgo(lastActivity || project.updated_at)}
          </span>
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
      </div>

      <div className="project-card__progress-section">
        <ProgressBar
          progressPercent={progressInfo.progressPercent}
          activePercent={progressInfo.activePercent}
          completedCount={progressInfo.completedCount}
          activeStageLabel={progressInfo.activeStageLabel}
        />
        <div className="project-card__progress-info">
          {stageLabel}
        </div>
      </div>
    </div>
  )
}

export default ProjectCard
