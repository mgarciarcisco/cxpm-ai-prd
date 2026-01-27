import { useMemo } from 'react';
import './PRDStreamingPreview.css';

/**
 * PRDStreamingPreview component for displaying PRD generation results as they arrive.
 * Shows sections with real-time updates during streaming.
 *
 * @param {Object} props
 * @param {string|null} props.title - The PRD title (from streaming)
 * @param {Array} props.sections - Array of PRD sections from streaming hook
 * @param {string} props.status - Current streaming status (idle, connecting, connected, complete, error)
 * @param {string|null} props.error - Error message if status is error
 * @param {Function} props.onRetry - Callback function to retry generation
 * @param {Function} props.onCancel - Callback function to cancel generation
 * @param {string|null} props.prdId - The generated PRD ID (when complete)
 * @param {Function} props.onViewPRD - Callback when user wants to view/edit the full PRD
 */
export function PRDStreamingPreview({ 
  title, 
  sections, 
  status, 
  error, 
  onRetry, 
  onCancel,
  prdId,
  onViewPRD,
}) {
  // Check if processing (includes connecting, connected states)
  const isProcessing = ['connecting', 'connected', 'generating'].includes(status);

  // Count total sections
  const totalSections = sections?.length || 0;

  // Render error state
  if (status === 'error') {
    return (
      <div className="prd-streaming-preview prd-streaming-preview--error">
        <div className="prd-streaming-error">
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
          <h3>PRD Generation Failed</h3>
          <p>{error || 'An error occurred during PRD generation.'}</p>
          {onRetry && (
            <button className="prd-streaming-retry-btn" onClick={onRetry}>
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }

  // Render idle state (before generation starts)
  if (status === 'idle') {
    return null; // Don't show anything when idle
  }

  return (
    <div className="prd-streaming-preview">
      {/* Status header */}
      <div className="prd-streaming-header">
        {isProcessing && (
          <div className="prd-streaming-status prd-streaming-status--processing">
            <div className="prd-streaming-spinner" />
            <span>
              {totalSections > 0 
                ? `Generating PRD... ${totalSections} section${totalSections !== 1 ? 's' : ''} created`
                : 'Analyzing requirements and generating PRD...'}
            </span>
            {onCancel && (
              <button className="prd-streaming-cancel-btn" onClick={onCancel}>
                Cancel
              </button>
            )}
          </div>
        )}
        {status === 'complete' && (
          <div className="prd-streaming-status prd-streaming-status--complete">
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
              PRD generated successfully! {totalSections} section{totalSections !== 1 ? 's' : ''} created.
            </span>
            {prdId && onViewPRD && (
              <button className="prd-streaming-view-btn" onClick={() => onViewPRD(prdId)}>
                View & Edit PRD
              </button>
            )}
          </div>
        )}
      </div>

      {/* PRD Title */}
      {title && (
        <div className="prd-streaming-title-section">
          <h2 className="prd-streaming-title">{title}</h2>
        </div>
      )}

      {/* Sections */}
      {sections && sections.length > 0 && (
        <div className="prd-streaming-sections-list">
          {sections.map((section, index) => (
            <div key={section.id || index} className="prd-streaming-section-item">
              <div className="prd-streaming-section-header">
                <span className="prd-streaming-section-number">{index + 1}</span>
                <h3 className="prd-streaming-section-title">{section.title}</h3>
              </div>
              <div className="prd-streaming-section-content">
                {section.content}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Show processing indicator at bottom while streaming */}
      {isProcessing && totalSections > 0 && (
        <div className="prd-streaming-footer">
          <div className="prd-streaming-footer-spinner" />
          <span>Generating more sections...</span>
        </div>
      )}
    </div>
  );
}

export default PRDStreamingPreview;
