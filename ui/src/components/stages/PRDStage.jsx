import React, { useState, useEffect, useCallback } from 'react';
import Markdown from 'react-markdown';
import { EmptyState } from '../common/EmptyState';
import GeneratePRDModal from '../prd/GeneratePRDModal';
import { usePRDStreamingV2, SectionStatus } from '../../hooks/usePRDStreamingV2';
import './StageContent.css';
import './PRDStage.css';

/**
 * PRD stage content component.
 * Shows empty state when no PRD exists, with options to generate from requirements or write manually.
 * Shows warning if requirements are not yet reviewed.
 * Supports section-by-section streaming during PRD generation.
 */
function PRDStage({ project, onProjectUpdate }) {
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationMode, setGenerationMode] = useState(null);

  // Use the PRD streaming hook
  const {
    getSortedSections,
    getCompletedCount,
    getTotalCount,
    status: streamStatus,
    error: streamError,
    retry,
  } = usePRDStreamingV2(project?.id, generationMode, isGenerating);

  // Check if PRD exists (prd_status !== 'empty')
  const hasPRD = project?.prd_status && project.prd_status !== 'empty';

  // Check if requirements are complete (reviewed)
  const requirementsComplete = project?.requirements_status === 'reviewed';

  // Handle stream completion
  useEffect(() => {
    if (streamStatus === 'complete' || streamStatus === 'partial') {
      setIsGenerating(false);
      // Refresh project data to update prd_status
      if (onProjectUpdate) {
        onProjectUpdate();
      }
    }
  }, [streamStatus, onProjectUpdate]);

  // Handle stream error
  useEffect(() => {
    if (streamStatus === 'error') {
      setIsGenerating(false);
    }
  }, [streamStatus]);

  // PRD document icon
  const prdIcon = (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 8H36C38.2091 8 40 9.79086 40 12V36C40 38.2091 38.2091 40 36 40H12C9.79086 40 8 38.2091 8 36V12C8 9.79086 9.79086 8 12 8Z" stroke="currentColor" strokeWidth="2"/>
      <path d="M16 16H32" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M16 22H32" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M16 28H26" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M16 34H22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );

  // Warning icon for incomplete requirements
  const warningIcon = (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 5.5V8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="8" cy="11" r="0.75" fill="currentColor"/>
      <path d="M6.86 2.573L1.215 12.427C.77 13.2 1.322 14.167 2.216 14.167h11.568c.894 0 1.446-.966 1.001-1.74L9.14 2.573c-.44-.765-1.54-.765-1.98 0z" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );

  // Open the generate modal
  const handleGenerateFromReqs = () => {
    setShowGenerateModal(true);
  };

  // Handle generation start from modal
  const handleGenerate = useCallback((mode) => {
    setShowGenerateModal(false);
    setGenerationMode(mode);
    setIsGenerating(true);
  }, []);

  const handleWriteManually = () => {
    console.log('Write PRD manually');
    // TODO: Open PRD editor directly (P3-027)
  };

  const handleRetry = () => {
    retry();
  };

  // Get sorted sections for rendering
  const sortedSections = getSortedSections();
  const completedCount = getCompletedCount();
  const totalCount = getTotalCount();

  // Show generation view when generating
  if (isGenerating || (sortedSections.length > 0 && streamStatus !== 'complete' && streamStatus !== 'partial' && streamStatus !== 'error')) {
    return (
      <div className="stage-content stage-content--prd">
        <div className="prd-generation">
          {/* Progress indicator */}
          <div className="prd-generation__header">
            <div className="prd-generation__progress">
              <div className="prd-generation__spinner" />
              <span className="prd-generation__status">
                {totalCount > 0
                  ? `Generating... Section ${completedCount + 1} of ${totalCount}`
                  : 'Starting generation...'}
              </span>
            </div>
            <div className="prd-generation__mode">
              {generationMode === 'detailed' ? 'Detailed' : 'Brief'} PRD
            </div>
          </div>

          {/* Progress bar */}
          {totalCount > 0 && (
            <div className="prd-generation__progress-bar">
              <div
                className="prd-generation__progress-fill"
                style={{ width: `${(completedCount / totalCount) * 100}%` }}
              />
            </div>
          )}

          {/* Sections */}
          <div className="prd-generation__sections">
            {sortedSections.map((section) => (
              <div
                key={section.id}
                className={`prd-section prd-section--${section.status}`}
              >
                {/* Section header */}
                <div className="prd-section__header">
                  <span className="prd-section__status-icon">
                    {section.status === SectionStatus.COMPLETED && (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M13.5 4.5L6 12L2.5 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                    {section.status === SectionStatus.GENERATING && (
                      <div className="prd-section__spinner" />
                    )}
                    {section.status === SectionStatus.PENDING && (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2"/>
                      </svg>
                    )}
                    {section.status === SectionStatus.FAILED && (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    )}
                  </span>
                  <span className="prd-section__title">
                    {section.title || formatSectionId(section.id)}
                  </span>
                </div>

                {/* Section content - show for completed or generating sections */}
                {(section.status === SectionStatus.COMPLETED || section.status === SectionStatus.GENERATING) && section.content && (
                  <div className="prd-section__content">
                    <Markdown>{section.content}</Markdown>
                  </div>
                )}

                {/* Pending placeholder */}
                {section.status === SectionStatus.PENDING && (
                  <div className="prd-section__placeholder">
                    Waiting to generate...
                  </div>
                )}

                {/* Failed message */}
                {section.status === SectionStatus.FAILED && (
                  <div className="prd-section__error">
                    {section.error || 'Failed to generate this section'}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Show error state if generation failed
  if (streamStatus === 'error') {
    return (
      <div className="stage-content stage-content--prd">
        <div className="prd-error">
          <div className="prd-error__icon">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2"/>
              <path d="M24 14v12M24 30v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <h3 className="prd-error__title">Generation Failed</h3>
          <p className="prd-error__message">{streamError}</p>
          <div className="prd-error__actions">
            <button onClick={handleRetry}>Try Again</button>
            <button className="secondary" onClick={() => setIsGenerating(false)}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show completed PRD with sections
  if ((streamStatus === 'complete' || streamStatus === 'partial') && sortedSections.length > 0) {
    return (
      <div className="stage-content stage-content--prd">
        <div className="prd-content">
          {/* Completion notice */}
          <div className="prd-content__header">
            <span className="prd-content__title">
              Product Requirements Document
            </span>
            {streamStatus === 'partial' && (
              <span className="prd-content__warning">
                Some sections failed to generate
              </span>
            )}
          </div>

          {/* Sections */}
          <div className="prd-content__sections">
            {sortedSections.map((section) => (
              <div
                key={section.id}
                className={`prd-section prd-section--${section.status}`}
              >
                <h2 className="prd-section__title">
                  {section.title || formatSectionId(section.id)}
                </h2>
                {section.status === SectionStatus.COMPLETED && section.content && (
                  <div className="prd-section__content">
                    <Markdown>{section.content}</Markdown>
                  </div>
                )}
                {section.status === SectionStatus.FAILED && (
                  <div className="prd-section__error">
                    {section.error || 'Failed to generate this section'}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Empty state - no PRD yet
  if (!hasPRD) {
    return (
      <div className="stage-content stage-content--prd">
        {/* Warning banner if requirements not complete */}
        {!requirementsComplete && (
          <div className="prd-stage__warning">
            <span className="prd-stage__warning-icon">{warningIcon}</span>
            <span className="prd-stage__warning-text">
              Requirements are not yet reviewed. Consider reviewing requirements before generating a PRD.
            </span>
          </div>
        )}

        <EmptyState
          icon={prdIcon}
          title="No PRD generated yet"
          description="Generate a detailed PRD from your requirements or write one manually."
          actions={[
            <button
              key="generate"
              onClick={handleGenerateFromReqs}
              disabled={!requirementsComplete}
              title={!requirementsComplete ? 'Review requirements first' : undefined}
            >
              Generate from Reqs
            </button>,
            <button
              key="manual"
              className="secondary"
              onClick={handleWriteManually}
            >
              Write Manually
            </button>
          ]}
        />

        {/* Generate PRD Modal */}
        {showGenerateModal && (
          <GeneratePRDModal
            projectId={project?.id}
            onClose={() => setShowGenerateModal(false)}
            onGenerate={handleGenerate}
          />
        )}
      </div>
    );
  }

  // PRD exists - placeholder for P3-011 (view/edit PRD)
  return (
    <div className="stage-content stage-content--prd">
      <div className="stage-content__placeholder">
        <div className="stage-content__placeholder-icon">
          {prdIcon}
        </div>
        <h2 className="stage-content__placeholder-title">Product Requirements Document</h2>
        <p className="stage-content__placeholder-text">
          PRD content view will be implemented in future tasks.
        </p>
      </div>
    </div>
  );
}

/**
 * Format a section ID into a readable title
 * e.g., 'problem_statement' -> 'Problem Statement'
 */
function formatSectionId(sectionId) {
  if (!sectionId) return 'Section';
  return sectionId
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default PRDStage;
