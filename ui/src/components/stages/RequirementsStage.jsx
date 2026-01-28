import React from 'react';
import './StageContent.css';

/**
 * Placeholder for Requirements stage content.
 * Full implementation in P3-001 and related tasks.
 */
function RequirementsStage({ project: _project }) {
  return (
    <div className="stage-content stage-content--requirements">
      <div className="stage-content__placeholder">
        <div className="stage-content__placeholder-icon">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="8" y="8" width="32" height="32" rx="4" stroke="currentColor" strokeWidth="2"/>
            <path d="M16 18H32" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M16 24H28" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M16 30H24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <h2 className="stage-content__placeholder-title">Requirements</h2>
        <p className="stage-content__placeholder-text">
          Gather and organize project requirements from meetings or add them manually.
        </p>
      </div>
    </div>
  );
}

export default RequirementsStage;
