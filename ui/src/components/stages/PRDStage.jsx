import React from 'react';
import { EmptyState } from '../common/EmptyState';
import './StageContent.css';
import './PRDStage.css';

/**
 * PRD stage content component.
 * Shows empty state when no PRD exists, with options to generate from requirements or write manually.
 * Shows warning if requirements are not yet reviewed.
 */
function PRDStage({ project }) {
  // Check if PRD exists (prd_status !== 'empty')
  const hasPRD = project?.prd_status && project.prd_status !== 'empty';

  // Check if requirements are complete (reviewed)
  const requirementsComplete = project?.requirements_status === 'reviewed';

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

  // Handlers (placeholders for now - will be implemented in P3-009 and P3-027)
  const handleGenerateFromReqs = () => {
    console.log('Generate PRD from requirements');
    // TODO: Open GeneratePRDModal (P3-009)
  };

  const handleWriteManually = () => {
    console.log('Write PRD manually');
    // TODO: Open PRD editor directly (P3-027)
  };

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
      </div>
    );
  }

  // PRD exists - placeholder for P3-010, P3-011 (view/edit PRD)
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

export default PRDStage;
