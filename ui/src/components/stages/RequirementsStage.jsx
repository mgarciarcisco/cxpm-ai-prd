import React from 'react';
import { EmptyState } from '../common/EmptyState';
import './StageContent.css';

/**
 * Requirements stage content component.
 * Shows empty state when no requirements exist, with options to add from meeting or manually.
 */
function RequirementsStage({ project }) {
  // Check if there are any requirements (requirements_status !== 'empty')
  const hasRequirements = project?.requirements_status && project.requirements_status !== 'empty';

  // Requirements icon SVG
  const requirementsIcon = (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="8" width="32" height="32" rx="4" stroke="currentColor" strokeWidth="2"/>
      <path d="M16 18H32" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M16 24H28" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M16 30H24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );

  // Handle Add Meeting button click
  const handleAddMeeting = () => {
    // TODO: Open Add Meeting modal (P3-002a)
    console.log('Add Meeting clicked');
  };

  // Handle Add Manually button click
  const handleAddManually = () => {
    // TODO: Open Add Manually modal (P3-003)
    console.log('Add Manually clicked');
  };

  // Empty state - no requirements yet
  if (!hasRequirements) {
    return (
      <div className="stage-content stage-content--requirements">
        <EmptyState
          icon={requirementsIcon}
          title="No requirements yet"
          description="Extract from a meeting or add manually"
          actions={[
            <button key="meeting" onClick={handleAddMeeting}>Add Meeting</button>,
            <button key="manual" className="secondary" onClick={handleAddManually}>Add Manually</button>
          ]}
        />
      </div>
    );
  }

  // TODO: Requirements list view (P3-004)
  return (
    <div className="stage-content stage-content--requirements">
      <div className="stage-content__placeholder">
        <p>Requirements list coming soon (P3-004)</p>
      </div>
    </div>
  );
}

export default RequirementsStage;
