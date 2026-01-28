import React from 'react';
import './StageContent.css';

/**
 * Placeholder for User Stories stage content.
 * Full implementation in P3-015 and related tasks.
 */
function UserStoriesStage({ project: _project }) {
  return (
    <div className="stage-content stage-content--stories">
      <div className="stage-content__placeholder">
        <div className="stage-content__placeholder-icon">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="8" y="10" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="2"/>
            <rect x="26" y="10" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="2"/>
            <rect x="8" y="26" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="2"/>
            <rect x="26" y="26" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="2"/>
          </svg>
        </div>
        <h2 className="stage-content__placeholder-title">User Stories</h2>
        <p className="stage-content__placeholder-text">
          Generate user stories from your PRD or create them manually.
        </p>
      </div>
    </div>
  );
}

export default UserStoriesStage;
