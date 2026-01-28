import React from 'react';
import './StageContent.css';

/**
 * Placeholder for Mockups stage content.
 * Full implementation in P5-001 and related tasks.
 */
function MockupsStage({ project: _project }) {
  return (
    <div className="stage-content stage-content--mockups">
      <div className="stage-content__placeholder">
        <div className="stage-content__placeholder-icon">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="8" y="8" width="32" height="32" rx="4" stroke="currentColor" strokeWidth="2"/>
            <circle cx="18" cy="18" r="4" stroke="currentColor" strokeWidth="2"/>
            <path d="M8 32L18 24L26 30L40 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h2 className="stage-content__placeholder-title">Mockups</h2>
        <p className="stage-content__placeholder-text">
          Generate UI mockups from your user stories or describe what you need.
        </p>
      </div>
    </div>
  );
}

export default MockupsStage;
