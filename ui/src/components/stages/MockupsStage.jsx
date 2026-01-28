import React from 'react';
import { EmptyState } from '../common/EmptyState';
import './StageContent.css';

/**
 * Mockups stage content component.
 * Shows empty state when no mockups exist, with options to generate from stories or describe manually.
 */
function MockupsStage({ project }) {
  // Check if there are any mockups (mockups_status !== 'empty')
  const hasMockups = project?.mockups_status && project.mockups_status !== 'empty';

  // Check if user stories are refined (ready for mockup generation)
  const storiesRefined = project?.stories_status === 'refined';

  // Mockups icon SVG
  const mockupsIcon = (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="8" width="32" height="32" rx="4" stroke="currentColor" strokeWidth="2"/>
      <circle cx="18" cy="18" r="4" stroke="currentColor" strokeWidth="2"/>
      <path d="M8 32L18 24L26 30L40 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  // Handle Generate from Stories button click
  const handleGenerateFromStories = () => {
    // TODO: Implement in P5-002
    console.log('Generate mockups from stories');
  };

  // Handle Describe Manually button click
  const handleDescribeManually = () => {
    // TODO: Implement in future task
    console.log('Describe mockup manually');
  };

  // Empty state - no mockups yet
  if (!hasMockups) {
    return (
      <div className="stage-content stage-content--mockups">
        <EmptyState
          icon={mockupsIcon}
          title="No mockups yet"
          description="Generate UI mockups from your user stories or describe what you need."
          actions={[
            <button
              key="generate"
              onClick={handleGenerateFromStories}
              disabled={!storiesRefined}
              title={!storiesRefined ? 'Refine user stories first' : undefined}
            >
              Generate from Stories
            </button>,
            <button
              key="describe"
              className="secondary"
              onClick={handleDescribeManually}
            >
              Describe Manually
            </button>
          ]}
        />
      </div>
    );
  }

  // TODO: Implement mockups list view in future tasks
  return (
    <div className="stage-content stage-content--mockups">
      <p>Mockups content coming soon...</p>
    </div>
  );
}

export default MockupsStage;
