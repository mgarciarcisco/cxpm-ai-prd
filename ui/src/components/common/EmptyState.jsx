import './EmptyState.css';

/**
 * EmptyState component for displaying placeholder content when no data exists.
 * Modern illustrated style with gradient backgrounds and engaging copy.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.icon - Icon or illustration to display (SVG or emoji)
 * @param {string} props.emoji - Emoji to display as illustration (alternative to icon)
 * @param {string} props.title - Title text
 * @param {string} props.description - Description text
 * @param {React.ReactNode} props.actionButton - Single action button (legacy support)
 * @param {React.ReactNode[]} props.actions - Array of action buttons
 */
export function EmptyState({ icon, emoji, title, description, actionButton, actions }) {
  // Combine legacy actionButton with actions array for backward compatibility
  const allActions = actions || (actionButton ? [actionButton] : []);

  return (
    <div className="empty-state">
      {(icon || emoji) && (
        <div className="empty-state__illustration">
          {emoji ? (
            <span className="empty-state__emoji">{emoji}</span>
          ) : (
            <div className="empty-state__icon">{icon}</div>
          )}
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
            <div key={index} className={`empty-state__action ${index > 0 ? 'empty-state__action--secondary' : ''}`}>
              {action}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default EmptyState;
