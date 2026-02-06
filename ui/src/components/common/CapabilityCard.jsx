import React from 'react';
import './CapabilityCard.css';

/**
 * Derive status text for a capability in workspace mode.
 */
function getStatusText(capability, stats, project) {
  switch (capability.id) {
    case 'requirements': {
      const reqCount = stats?.requirement_count ?? 0;
      const meetCount = stats?.meeting_count ?? 0;
      if (reqCount === 0 && meetCount === 0) return { text: 'Not started yet', active: false };
      const parts = [];
      if (reqCount > 0) parts.push(`${reqCount} requirement${reqCount !== 1 ? 's' : ''}`);
      if (meetCount > 0) parts.push(`${meetCount} meeting${meetCount !== 1 ? 's' : ''}`);
      return { text: parts.join(' \u00b7 '), active: true };
    }
    case 'prd': {
      const status = project?.prd_status || 'empty';
      if (status === 'empty') return { text: 'Not started yet', active: false };
      if (status === 'draft') return { text: 'PRD draft', active: true };
      return { text: 'PRD complete', active: true };
    }
    case 'stories': {
      const status = project?.stories_status || 'empty';
      if (status === 'empty') return { text: 'Not started yet', active: false };
      return { text: 'Stories generated', active: true };
    }
    case 'mockups': {
      const status = project?.mockups_status || 'empty';
      if (status === 'empty') return { text: 'Not started yet', active: false };
      return { text: 'Mockups generated', active: true };
    }
    case 'features':
      return { text: 'Coming soon', active: false };
    default:
      return { text: 'Not started yet', active: false };
  }
}

/**
 * Get button label for workspace mode.
 */
function getButtonLabel(capability, project) {
  if (capability.comingSoon) return 'Coming Soon';

  switch (capability.id) {
    case 'requirements': {
      const status = project?.requirements_status || 'empty';
      return status === 'empty' ? 'Get Started' : 'View Requirements';
    }
    case 'prd': {
      const status = project?.prd_status || 'empty';
      return status === 'empty' ? 'Generate PRD' : 'View PRD';
    }
    case 'stories': {
      const status = project?.stories_status || 'empty';
      return status === 'empty' ? 'Generate Stories' : 'View Stories';
    }
    case 'mockups': {
      const status = project?.mockups_status || 'empty';
      return status === 'empty' ? 'Create Mockups' : 'View Mockups';
    }
    default:
      return 'Open';
  }
}

/**
 * CapabilityCard — reusable card for dashboard (info mode) and workspace (workspace mode).
 *
 * Props:
 *   capability - Object from CAPABILITIES constant
 *   mode       - 'info' (dashboard new user) | 'workspace' (project view)
 *   stats      - Project stats (workspace only)
 *   project    - Project object (workspace only)
 *   projectId  - For navigation (workspace only)
 *   onAction   - Callback for workspace button clicks: onAction('primary') or onAction('upload')
 */
function CapabilityCard({ capability, mode = 'info', stats, project, onAction }) {
  const isInfo = mode === 'info';
  const isWorkspace = mode === 'workspace';
  const statusInfo = isWorkspace ? getStatusText(capability, stats, project) : null;
  const buttonLabel = isWorkspace ? getButtonLabel(capability, project) : null;

  const cardClasses = [
    'capability-card',
    `capability-card--${capability.colorName}`,
    isInfo && 'capability-card--info',
    isWorkspace && 'capability-card--workspace',
  ].filter(Boolean).join(' ');

  const handlePrimaryClick = (e) => {
    e.stopPropagation();
    if (onAction && !capability.comingSoon) {
      onAction('primary');
    }
  };

  const handleUploadClick = (e) => {
    e.stopPropagation();
    if (onAction) {
      onAction('upload');
    }
  };

  const handleCardClick = () => {
    if (isWorkspace && onAction && !capability.comingSoon) {
      onAction('primary');
    }
  };

  const handleKeyDown = (e) => {
    if (isWorkspace && !capability.comingSoon && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onAction?.('primary');
    }
  };

  return (
    <div
      className={cardClasses}
      style={{ '--card-color': capability.colorHex }}
      onClick={isWorkspace ? handleCardClick : undefined}
      onKeyDown={isWorkspace ? handleKeyDown : undefined}
      tabIndex={isWorkspace && !capability.comingSoon ? 0 : undefined}
      role={isWorkspace && !capability.comingSoon ? 'button' : undefined}
      aria-disabled={isInfo || capability.comingSoon ? 'true' : undefined}
    >
      {/* Left color border is done via CSS border-left */}

      <div className="capability-card__top">
        <div className="capability-card__icon" style={{ borderColor: capability.colorHex }}>
          {capability.icon}
        </div>
        {capability.comingSoon && (
          <span className="capability-card__coming-soon-badge">Coming Soon</span>
        )}
      </div>

      <h3 className="capability-card__title">{capability.title}</h3>
      <p className="capability-card__description">{capability.description}</p>

      <div className="capability-card__io">
        <div className="capability-card__io-row">
          <span className="capability-card__io-label">Input</span>
          <span className="capability-card__io-text">{capability.inputText}</span>
        </div>
        <div className="capability-card__io-row">
          <span className="capability-card__io-label">Output</span>
          <span className="capability-card__io-text">{capability.outputText}</span>
        </div>
      </div>

      {/* Workspace-only: status + actions */}
      {isWorkspace && (
        <div className="capability-card__workspace-footer">
          <div className="capability-card__status">
            <span className={`capability-card__status-dot ${statusInfo.active ? 'capability-card__status-dot--active' : ''}`} />
            <span className="capability-card__status-text">{statusInfo.text}</span>
          </div>

          {/* Tip line - show when not started and tip exists */}
          {!statusInfo.active && capability.tip && (
            <p className="capability-card__tip">{capability.tip}</p>
          )}

          <div className="capability-card__actions">
            <button
              className={`capability-card__btn capability-card__btn--primary ${capability.comingSoon ? 'capability-card__btn--disabled' : ''}`}
              onClick={handlePrimaryClick}
              disabled={capability.comingSoon}
            >
              {buttonLabel}
            </button>
            {capability.id === 'requirements' && (
              <button
                className="capability-card__btn capability-card__btn--secondary"
                onClick={handleUploadClick}
              >
                Upload Meeting Notes
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default CapabilityCard;
