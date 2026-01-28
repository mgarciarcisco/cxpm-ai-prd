import React from 'react';
import './StageContent.css';

/**
 * Placeholder for Export stage content.
 * Full implementation in P5-009 and related tasks.
 */
function ExportStage({ project: _project }) {
  return (
    <div className="stage-content stage-content--export">
      <div className="stage-content__placeholder">
        <div className="stage-content__placeholder-icon">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M24 8V28" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M16 20L24 28L32 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M8 36H40" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M8 36V40H40V36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h2 className="stage-content__placeholder-title">Export</h2>
        <p className="stage-content__placeholder-text">
          Export your project data as Markdown, JSON, or integrate with external tools.
        </p>
      </div>
    </div>
  );
}

export default ExportStage;
