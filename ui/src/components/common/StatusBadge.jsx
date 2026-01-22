import './StatusBadge.css';

const STATUS_CONFIG = {
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
};

export function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;

  return (
    <span className={`status-badge ${config.className}`}>
      {config.label}
    </span>
  );
}

export default StatusBadge;
