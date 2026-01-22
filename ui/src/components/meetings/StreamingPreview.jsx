import { useMemo } from 'react';
import './StreamingPreview.css';

/**
 * Section configuration for display order and labels
 */
const SECTIONS = [
  { key: 'problems', label: 'Problems' },
  { key: 'user_goals', label: 'User Goals' },
  { key: 'functional_requirements', label: 'Functional Requirements' },
  { key: 'data_needs', label: 'Data Needs' },
  { key: 'constraints', label: 'Constraints' },
  { key: 'non_goals', label: 'Non-Goals' },
  { key: 'risks_assumptions', label: 'Risks & Assumptions' },
  { key: 'open_questions', label: 'Open Questions' },
  { key: 'action_items', label: 'Action Items' },
];

/**
 * StreamingPreview component for displaying extraction results as they arrive.
 * Shows items grouped by section with real-time updates.
 *
 * @param {Object} props
 * @param {Array} props.items - Array of extracted items from useStreaming hook
 * @param {string} props.status - Current streaming status (idle, connecting, connected, processing, complete, error)
 * @param {string|null} props.error - Error message if status is error
 * @param {Function} props.onRetry - Callback function to retry extraction
 */
export function StreamingPreview({ items, status, error, onRetry }) {
  // Group items by section
  const groupedItems = useMemo(() => {
    const groups = {};
    SECTIONS.forEach((section) => {
      groups[section.key] = [];
    });
    items.forEach((item) => {
      if (groups[item.section]) {
        groups[item.section].push(item);
      }
    });
    return groups;
  }, [items]);

  // Check if processing (includes connecting, connected, processing states)
  const isProcessing = ['connecting', 'connected', 'processing'].includes(status);

  // Count total items
  const totalItems = items.length;

  // Render error state
  if (status === 'error') {
    return (
      <div className="streaming-preview streaming-preview--error">
        <div className="streaming-error">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <h3>Extraction Failed</h3>
          <p>{error || 'An error occurred during extraction.'}</p>
          {onRetry && (
            <button className="streaming-retry-btn" onClick={onRetry}>
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="streaming-preview">
      {/* Status header */}
      <div className="streaming-header">
        {isProcessing && (
          <div className="streaming-status streaming-status--processing">
            <div className="streaming-spinner" />
            <span>Extracting requirements from meeting notes...</span>
          </div>
        )}
        {status === 'complete' && (
          <div className="streaming-status streaming-status--complete">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span>
              Extraction complete! {totalItems} item{totalItems !== 1 ? 's' : ''} extracted.
            </span>
          </div>
        )}
        {status === 'idle' && (
          <div className="streaming-status streaming-status--idle">
            <span>Waiting to start extraction...</span>
          </div>
        )}
      </div>

      {/* Items grouped by section */}
      <div className="streaming-sections">
        {SECTIONS.map((section) => {
          const sectionItems = groupedItems[section.key];
          if (sectionItems.length === 0 && status !== 'complete') {
            return null; // Don't show empty sections while processing
          }
          return (
            <div key={section.key} className="streaming-section">
              <h3 className="streaming-section-title">
                {section.label}
                <span className="streaming-section-count">
                  {sectionItems.length}
                </span>
              </h3>
              {sectionItems.length > 0 ? (
                <ul className="streaming-items">
                  {sectionItems.map((item, index) => (
                    <li key={index} className="streaming-item">
                      {item.content}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="streaming-empty-section">No items in this section</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Show processing indicator at bottom while streaming */}
      {isProcessing && totalItems > 0 && (
        <div className="streaming-footer">
          <div className="streaming-footer-spinner" />
          <span>Continuing to extract items...</span>
        </div>
      )}
    </div>
  );
}

export default StreamingPreview;
