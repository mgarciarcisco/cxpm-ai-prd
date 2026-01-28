import React from 'react';
import './StageContent.css';

/**
 * Placeholder for PRD stage content.
 * Full implementation in P3-008 and related tasks.
 */
function PRDStage({ project: _project }) {
  return (
    <div className="stage-content stage-content--prd">
      <div className="stage-content__placeholder">
        <div className="stage-content__placeholder-icon">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 8H36C38.2091 8 40 9.79086 40 12V36C40 38.2091 38.2091 40 36 40H12C9.79086 40 8 38.2091 8 36V12C8 9.79086 9.79086 8 12 8Z" stroke="currentColor" strokeWidth="2"/>
            <path d="M16 16H32" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M16 22H32" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M16 28H26" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M16 34H22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <h2 className="stage-content__placeholder-title">Product Requirements Document</h2>
        <p className="stage-content__placeholder-text">
          Generate a detailed PRD from your requirements or write one manually.
        </p>
      </div>
    </div>
  );
}

export default PRDStage;
