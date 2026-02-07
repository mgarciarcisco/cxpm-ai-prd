import React from 'react';
import { useNavigate } from 'react-router-dom';
import './HeroProjectCard.css';

/**
 * Format relative time for "Last active" display.
 */
function formatRelativeTime(dateString) {
  if (!dateString) return '';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  if (diffMs < 0) return 'Just now';
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString();
}

/**
 * HeroProjectCard — "Continue where you left off" card for the most recent project.
 *
 * Props:
 *   project  - project object with merged stats (meetingCount, requirementCount, lastActivity)
 */
function HeroProjectCard({ project }) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/projects/${project.id}`);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  // Build artifact badges
  const badges = [];
  const meetingCount = project.meetingCount || 0;
  const requirementCount = project.requirementCount || 0;
  const jiraEpicCount = project.jiraEpicCount ?? 0;

  if (meetingCount > 0 || requirementCount > 0 || jiraEpicCount > 0) {
    const parts = [];
    if (meetingCount > 0) parts.push(`${meetingCount} meeting${meetingCount !== 1 ? 's' : ''}`);
    if (requirementCount > 0) parts.push(`${requirementCount} requirement${requirementCount !== 1 ? 's' : ''}`);
    if (jiraEpicCount > 0) parts.push(`${jiraEpicCount} Jira Epic${jiraEpicCount !== 1 ? 's' : ''}`);
    badges.push({ color: 'teal', text: parts.join(' \u00b7 ') });
  }

  const lastActive = project.lastActivity || project.updated_at;

  return (
    <div
      className="hero-project-card"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`Open project: ${project.name}`}
    >
      <div className="hero-project-card__content">
        <span className="hero-project-card__label">Continue where you left off</span>
        <h2 className="hero-project-card__name">{project.name}</h2>
        {project.description && (
          <p className="hero-project-card__description">{project.description}</p>
        )}

        {badges.length > 0 && (
          <div className="hero-project-card__badges">
            {badges.map((badge) => (
              <span key={badge.color} className={`hero-project-card__badge hero-project-card__badge--${badge.color}`}>
                {badge.text}
              </span>
            ))}
          </div>
        )}

        {lastActive && (
          <span className="hero-project-card__time">Last active: {formatRelativeTime(lastActive)}</span>
        )}
      </div>

      <div className="hero-project-card__action">
        <button className="hero-project-card__btn" tabIndex={-1}>
          Open Project
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

export default HeroProjectCard;
