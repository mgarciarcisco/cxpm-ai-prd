import { StatusBadge } from '../common/StatusBadge';
import './StageHeader.css';

/**
 * StageHeader component for consistent stage headers
 * @param {Object} props
 * @param {string} props.title - The stage title (e.g., 'Requirements', 'PRD')
 * @param {string} [props.subtitle] - Optional subtitle (e.g., '12 items across 4 sections')
 * @param {string} [props.status] - Status for the badge (empty, in_progress, complete)
 * @param {string} [props.statusLabel] - Optional custom label for the status badge
 * @param {React.ReactNode} [props.actions] - Optional slot for action buttons
 */
export function StageHeader({ title, subtitle, status, statusLabel, actions }) {
  return (
    <header className="stage-header">
      <div className="stage-header__info">
        <div className="stage-header__title-row">
          <h1 className="stage-header__title">{title}</h1>
          {status && (
            <StatusBadge status={status} label={statusLabel} />
          )}
        </div>
        {subtitle && (
          <p className="stage-header__subtitle">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="stage-header__actions">
          {actions}
        </div>
      )}
    </header>
  );
}

export default StageHeader;
