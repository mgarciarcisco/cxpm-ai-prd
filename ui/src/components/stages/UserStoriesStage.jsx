import React from 'react';
import { EmptyState } from '../common/EmptyState';
import './StageContent.css';
import './UserStoriesStage.css';

/**
 * User Stories stage content component.
 * Shows empty state when no user stories exist, with options to generate from PRD or add manually.
 * Shows warning if PRD is not yet ready.
 */
function UserStoriesStage({ project }) {
  // Check if there are any user stories (stories_status !== 'empty')
  const hasStories = project?.stories_status && project.stories_status !== 'empty';

  // Check if PRD is complete (ready)
  const prdComplete = project?.prd_status === 'ready';

  // User stories icon SVG
  const storiesIcon = (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="10" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="2"/>
      <rect x="26" y="10" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="2"/>
      <rect x="8" y="26" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="2"/>
      <rect x="26" y="26" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="2"/>
    </svg>
  );

  // Warning icon for incomplete PRD
  const warningIcon = (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 5.5V8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="8" cy="11" r="0.75" fill="currentColor"/>
      <path d="M6.86 2.573L1.215 12.427C.77 13.2 1.322 14.167 2.216 14.167h11.568c.894 0 1.446-.966 1.001-1.74L9.14 2.573c-.44-.765-1.54-.765-1.98 0z" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );

  // Handle Generate from PRD button click
  const handleGenerateFromPRD = () => {
    console.log('Generate stories from PRD');
    // TODO: Open GenerateStoriesModal (P3-016)
  };

  // Handle Add Manually button click
  const handleAddManually = () => {
    console.log('Add story manually');
    // TODO: Open StoryEditorModal (P3-020/P3-021)
  };

  // Empty state - no stories yet
  if (!hasStories) {
    return (
      <div className="stage-content stage-content--stories">
        {/* Warning banner if PRD not complete */}
        {!prdComplete && (
          <div className="stories-stage__warning">
            <span className="stories-stage__warning-icon">{warningIcon}</span>
            <span className="stories-stage__warning-text">
              PRD is not yet ready. Consider completing the PRD before generating user stories.
            </span>
          </div>
        )}

        <EmptyState
          icon={storiesIcon}
          title="No user stories yet"
          description="Generate user stories from your PRD or create them manually."
          actions={[
            <button
              key="generate"
              onClick={handleGenerateFromPRD}
              disabled={!prdComplete}
              title={!prdComplete ? 'Complete PRD first' : undefined}
            >
              Generate from PRD
            </button>,
            <button
              key="manual"
              className="secondary"
              onClick={handleAddManually}
            >
              Add Manually
            </button>
          ]}
        />
      </div>
    );
  }

  // Placeholder for stories list view (to be implemented in later tasks)
  return (
    <div className="stage-content stage-content--stories">
      <div className="stage-content__placeholder">
        <div className="stage-content__placeholder-icon">
          {storiesIcon}
        </div>
        <h2 className="stage-content__placeholder-title">User Stories</h2>
        <p className="stage-content__placeholder-text">
          Stories list view coming soon.
        </p>
      </div>
    </div>
  );
}

export default UserStoriesStage;
