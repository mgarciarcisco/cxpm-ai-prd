import './BulkActions.css';

/**
 * BulkActions component provides bulk action buttons for conflict resolution.
 *
 * @param {Array} conflicts - Array of conflict objects from the apply endpoint
 * @param {function} onAcceptAllAI - Callback when "Accept AI recommendations" is clicked
 * @param {boolean} disabled - Whether buttons should be disabled
 */
export function BulkActions({ conflicts, onAcceptAllAI, disabled = false }) {
  const hasConflicts = conflicts && conflicts.length > 0;

  if (!hasConflicts) {
    return null;
  }

  return (
    <div className="bulk-actions">
      <button
        type="button"
        className="bulk-actions-btn bulk-actions-btn--primary"
        onClick={onAcceptAllAI}
        disabled={disabled}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M8 1L10.163 5.27865L15 6.11146L11.5 9.45085L12.326 14L8 11.8787L3.674 14L4.5 9.45085L1 6.11146L5.837 5.27865L8 1Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Accept AI recommendations
      </button>
    </div>
  );
}

export default BulkActions;
