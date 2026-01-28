import { useMemo } from 'react';
import { SectionStatus } from '../../hooks/usePRDStreamingV2';
import './PRDStreamingPreviewV2.css';

/**
 * PRDStreamingPreviewV2 component for displaying staged PRD generation results.
 * Shows sections with per-section status: pending, generating, completed, failed.
 *
 * @param {Object} props
 * @param {Object} props.sections - Section data keyed by section_id
 * @param {Function} props.getSortedSections - Function to get sections sorted by order
 * @param {number|null} props.currentStage - Current generation stage (1, 2, or 3)
 * @param {string|null} props.streamingSection - Section ID currently streaming
 * @param {Function} props.getCompletedCount - Function to get completed section count
 * @param {Function} props.getTotalCount - Function to get total section count
 * @param {string} props.status - Overall status (idle, connecting, connected, generating, complete, partial, error)
 * @param {string|null} props.error - Error message if status is error
 * @param {Function} props.onRetry - Callback to retry generation
 * @param {Function} props.onCancel - Callback to cancel generation
 * @param {string|null} props.prdId - Generated PRD ID (when complete)
 * @param {Function} props.onViewPRD - Callback when user wants to view/edit the PRD
 * @param {Function} props.onRegenerateSection - Callback to regenerate a single section
 */
export function PRDStreamingPreviewV2({
  sections,
  getSortedSections,
  currentStage,
  streamingSection,
  getCompletedCount,
  getTotalCount,
  status,
  error,
  onRetry,
  onCancel,
  prdId,
  onViewPRD,
  onRegenerateSection,
}) {
  // Get sorted sections for display
  const sortedSections = useMemo(() => getSortedSections(), [getSortedSections]);

  // Check if processing
  const isProcessing = ['connecting', 'connected', 'generating'].includes(status);

  // Calculate progress
  const completedCount = getCompletedCount();
  const totalCount = getTotalCount();

  // Stage labels
  const stageLabels = {
    1: 'Stage 1: Generating core sections...',
    2: 'Stage 2: Generating detailed sections in parallel...',
    3: 'Stage 3: Generating executive summary...',
  };

  // Render error state
  if (status === 'error') {
    return (
      <div className="prd-preview-v2 prd-preview-v2--error">
        <div className="prd-preview-v2__error">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <h3>PRD Generation Failed</h3>
          <p>{error || 'An error occurred during PRD generation.'}</p>
          {onRetry && (
            <button className="prd-preview-v2__retry-btn" onClick={onRetry}>
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }

  // Render idle state
  if (status === 'idle') {
    return null;
  }

  return (
    <div className="prd-preview-v2">
      {/* Header with progress */}
      <div className="prd-preview-v2__header">
        {isProcessing && (
          <div className="prd-preview-v2__status prd-preview-v2__status--processing">
            <div className="prd-preview-v2__progress">
              <div className="prd-preview-v2__spinner" />
              <div className="prd-preview-v2__progress-text">
                <span className="prd-preview-v2__progress-main">
                  {currentStage ? stageLabels[currentStage] : 'Starting generation...'}
                </span>
                {totalCount > 0 && (
                  <span className="prd-preview-v2__progress-sub">
                    {completedCount} of {totalCount} sections completed
                  </span>
                )}
              </div>
            </div>
            {totalCount > 0 && (
              <div className="prd-preview-v2__progress-bar">
                <div
                  className="prd-preview-v2__progress-fill"
                  style={{ width: `${(completedCount / totalCount) * 100}%` }}
                />
              </div>
            )}
            {onCancel && (
              <button className="prd-preview-v2__cancel-btn" onClick={onCancel}>
                Cancel
              </button>
            )}
          </div>
        )}
        {(status === 'complete' || status === 'partial') && (
          <div className={`prd-preview-v2__status prd-preview-v2__status--${status}`}>
            {status === 'complete' ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            )}
            <span>
              {status === 'complete'
                ? `PRD generated successfully! ${completedCount} sections.`
                : `PRD partially generated. ${completedCount} of ${totalCount} sections completed.`}
            </span>
            {prdId && onViewPRD && (
              <button className="prd-preview-v2__view-btn" onClick={() => onViewPRD(prdId)}>
                View & Edit PRD
              </button>
            )}
          </div>
        )}
      </div>

      {/* Sections list */}
      {sortedSections.length > 0 && (
        <div className="prd-preview-v2__sections">
          {sortedSections.map((section) => (
            <SectionCard
              key={section.id}
              section={section}
              isStreaming={streamingSection === section.id}
              onRegenerate={onRegenerateSection}
            />
          ))}
        </div>
      )}

      {/* Footer while processing */}
      {isProcessing && sortedSections.length > 0 && (
        <div className="prd-preview-v2__footer">
          <div className="prd-preview-v2__footer-spinner" />
          <span>Generating more sections...</span>
        </div>
      )}
    </div>
  );
}

/**
 * Individual section card component
 */
function SectionCard({ section, isStreaming, onRegenerate }) {
  const { id, title, content, status, error } = section;

  // Determine card state
  const isPending = status === SectionStatus.PENDING;
  const isGenerating = status === SectionStatus.GENERATING || isStreaming;
  const isCompleted = status === SectionStatus.COMPLETED;
  const isFailed = status === SectionStatus.FAILED;

  return (
    <div className={`prd-section-card prd-section-card--${status}`}>
      <div className="prd-section-card__header">
        {/* Status indicator */}
        <div className="prd-section-card__status-icon">
          {isPending && <div className="prd-section-card__pending-icon" />}
          {isGenerating && <div className="prd-section-card__spinner" />}
          {isCompleted && (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          )}
          {isFailed && (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          )}
        </div>

        {/* Title */}
        <h3 className="prd-section-card__title">
          {title || id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
        </h3>

        {/* Actions */}
        {isCompleted && onRegenerate && (
          <button
            className="prd-section-card__regenerate-btn"
            onClick={() => onRegenerate(id)}
            title="Regenerate this section"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="1 4 1 10 7 10" />
              <polyline points="23 20 23 14 17 14" />
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
            </svg>
          </button>
        )}
        {isFailed && onRegenerate && (
          <button className="prd-section-card__retry-btn" onClick={() => onRegenerate(id)}>
            Retry
          </button>
        )}
      </div>

      {/* Content */}
      <div className="prd-section-card__content">
        {isPending && <span className="prd-section-card__pending-text">Waiting to generate...</span>}
        {isGenerating && (
          <>
            <span className="prd-section-card__streaming-content">{content}</span>
            <span className="prd-section-card__cursor" />
          </>
        )}
        {isCompleted && <div className="prd-section-card__completed-content">{content}</div>}
        {isFailed && <span className="prd-section-card__error-text">{error || 'Failed to generate section.'}</span>}
      </div>
    </div>
  );
}

export default PRDStreamingPreviewV2;
