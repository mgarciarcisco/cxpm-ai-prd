import './StatusBadge.css';

const STATUS_CONFIG = {
  // Conflict processing statuses
  pending: {
    label: 'Pending',
    className: 'status-badge--pending',
    tooltip: 'Waiting to be processed',
  },
  processing: {
    label: 'Processing',
    className: 'status-badge--processing',
    tooltip: 'Currently extracting requirements',
  },
  processed: {
    label: 'Processed',
    className: 'status-badge--processed',
    tooltip: 'Ready to apply to requirements',
  },
  applied: {
    label: 'Applied',
    className: 'status-badge--applied',
    tooltip: 'Requirements have been added to the project',
  },
  failed: {
    label: 'Failed',
    className: 'status-badge--failed',
    tooltip: 'Processing failed - click to retry',
  },
  // Project journey stage statuses
  empty: {
    label: 'Not Started',
    className: 'status-badge--empty',
    tooltip: 'This stage has not been started yet',
  },
  in_progress: {
    label: 'In Progress',
    className: 'status-badge--in-progress',
    tooltip: 'Currently working on this stage',
  },
  complete: {
    label: 'Complete',
    className: 'status-badge--complete',
    tooltip: 'This stage is complete',
  },
};

export function StatusBadge({ status, label, showTooltip = true }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const displayLabel = label || config.label;

  return (
    <span
      className={`status-badge ${config.className}`}
      title={showTooltip ? config.tooltip : undefined}
    >
      {displayLabel}
    </span>
  );
}

export default StatusBadge;
