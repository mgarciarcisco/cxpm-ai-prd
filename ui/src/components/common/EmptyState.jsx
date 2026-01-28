import './EmptyState.css';

/**
 * EmptyState component for displaying placeholder content when no data exists.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.icon - Icon or illustration to display
 * @param {string} props.title - Title text
 * @param {string} props.description - Description text
 * @param {React.ReactNode} props.actionButton - Single action button (legacy support)
 * @param {React.ReactNode[]} props.actions - Array of action buttons
 */
export function EmptyState({ icon, title, description, actionButton, actions }) {
  // Combine legacy actionButton with actions array for backward compatibility
  const allActions = actions || (actionButton ? [actionButton] : []);

  return (
    <div className="empty-state">
      {icon && (
        <div className="empty-state__icon">
          {icon}
        </div>
      )}
      {title && (
        <h3 className="empty-state__title">{title}</h3>
      )}
      {description && (
        <p className="empty-state__description">{description}</p>
      )}
      {allActions.length > 0 && (
        <div className="empty-state__actions">
          {allActions.map((action, index) => (
            <div key={index} className="empty-state__action">
              {action}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default EmptyState;
