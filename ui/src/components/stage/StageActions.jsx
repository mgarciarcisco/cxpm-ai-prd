import './StageActions.css';

/**
 * StageActions component for consistent stage action bars
 * Fixed to bottom of stage content area
 *
 * @param {Object} props
 * @param {Object} [props.primaryAction] - Primary action button
 * @param {string} props.primaryAction.label - Button text
 * @param {function} props.primaryAction.onClick - Click handler
 * @param {boolean} [props.primaryAction.disabled] - Disabled state
 * @param {boolean} [props.primaryAction.loading] - Loading state
 * @param {Object} [props.secondaryAction] - Secondary action button
 * @param {string} props.secondaryAction.label - Button text
 * @param {function} props.secondaryAction.onClick - Click handler
 * @param {boolean} [props.secondaryAction.disabled] - Disabled state
 * @param {Object} [props.tertiaryAction] - Tertiary action button (text style)
 * @param {string} props.tertiaryAction.label - Button text
 * @param {function} props.tertiaryAction.onClick - Click handler
 * @param {boolean} [props.tertiaryAction.disabled] - Disabled state
 * @param {string} [props.helperText] - Helper text shown below actions
 */
export function StageActions({
  primaryAction,
  secondaryAction,
  tertiaryAction,
  helperText,
}) {
  const hasActions = primaryAction || secondaryAction || tertiaryAction;

  if (!hasActions) {
    return null;
  }

  return (
    <footer className="stage-actions">
      <div className="stage-actions__container">
        <div className="stage-actions__buttons">
          {tertiaryAction && (
            <button
              type="button"
              className="stage-actions__btn stage-actions__btn--tertiary"
              onClick={tertiaryAction.onClick}
              disabled={tertiaryAction.disabled}
            >
              {tertiaryAction.label}
            </button>
          )}
          {secondaryAction && (
            <button
              type="button"
              className="stage-actions__btn stage-actions__btn--secondary"
              onClick={secondaryAction.onClick}
              disabled={secondaryAction.disabled}
            >
              {secondaryAction.label}
            </button>
          )}
          {primaryAction && (
            <button
              type="button"
              className="stage-actions__btn stage-actions__btn--primary"
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled || primaryAction.loading}
            >
              {primaryAction.loading && (
                <svg
                  className="stage-actions__spinner"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              )}
              {primaryAction.label}
            </button>
          )}
        </div>
        {helperText && (
          <p className="stage-actions__helper">{helperText}</p>
        )}
      </div>
    </footer>
  );
}

export default StageActions;
