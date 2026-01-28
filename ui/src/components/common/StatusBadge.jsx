import './StatusBadge.css';

const STATUS_CONFIG = {
  // Conflict processing statuses
  pending: {
    label: 'Pending',
    className: 'status-badge--pending',
  },
  processing: {
    label: 'Processing',
    className: 'status-badge--processing',
  },
  processed: {
    label: 'Processed',
    className: 'status-badge--processed',
  },
  applied: {
    label: 'Applied',
    className: 'status-badge--applied',
  },
  failed: {
    label: 'Failed',
    className: 'status-badge--failed',
  },
  // Project journey stage statuses
  empty: {
    label: 'Not Started',
    className: 'status-badge--empty',
  },
  in_progress: {
    label: 'In Progress',
    className: 'status-badge--in-progress',
  },
  complete: {
    label: 'Complete',
    className: 'status-badge--complete',
  },
};

export function StatusBadge({ status, label }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const displayLabel = label || config.label;

  return (
    <span className={`status-badge ${config.className}`}>
      {displayLabel}
    </span>
  );
}

export default StatusBadge;
