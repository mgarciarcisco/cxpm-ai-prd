import './EmptyState.css';

export function EmptyState({ icon, title, description, actionButton }) {
  return (
    <div className="empty-state">
      {icon && (
        <div className="empty-state-icon">
          {icon}
        </div>
      )}
      {title && (
        <h3 className="empty-state-title">{title}</h3>
      )}
      {description && (
        <p className="empty-state-description">{description}</p>
      )}
      {actionButton && (
        <div className="empty-state-action">
          {actionButton}
        </div>
      )}
    </div>
  );
}

export default EmptyState;
