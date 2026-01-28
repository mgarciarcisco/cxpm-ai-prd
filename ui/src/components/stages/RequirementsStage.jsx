import React, { useState, useEffect, useCallback } from 'react';
import { EmptyState } from '../common/EmptyState';
import { StageHeader } from '../stage/StageHeader';
import AddMeetingModal from '../requirements/AddMeetingModal';
import AddManuallyModal from '../requirements/AddManuallyModal';
import RequirementSection, { SECTION_ORDER } from '../requirements/RequirementSection';
import { get, put } from '../../services/api';
import './StageContent.css';
import './RequirementsStage.css';

/**
 * Map requirements status to stage header status format.
 */
function mapRequirementsStatus(status) {
  const statusMap = {
    empty: 'empty',
    has_items: 'in_progress',
    reviewed: 'complete',
  };
  return statusMap[status] || 'empty';
}

/**
 * Map requirements status to human-readable label.
 */
function getStatusLabel(status) {
  const labelMap = {
    empty: 'Empty',
    has_items: 'In Progress',
    reviewed: 'Reviewed',
  };
  return labelMap[status] || 'Empty';
}

/**
 * Requirements stage content component.
 * Shows empty state when no requirements exist, with options to add from meeting or manually.
 * Shows requirements list grouped by sections when requirements exist.
 */
function RequirementsStage({ project }) {
  const [showAddMeetingModal, setShowAddMeetingModal] = useState(false);
  const [showAddManuallyModal, setShowAddManuallyModal] = useState(false);
  const [addToSection, setAddToSection] = useState(null);
  const [requirements, setRequirements] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Check if there are any requirements (requirements_status !== 'empty')
  const hasRequirements = project?.requirements_status && project.requirements_status !== 'empty';

  // Fetch requirements when component mounts or project changes
  const fetchRequirements = useCallback(async () => {
    if (!project?.id) return;

    try {
      setLoading(true);
      setError(null);
      const data = await get(`/api/projects/${project.id}/requirements`);
      setRequirements(data);
    } catch (err) {
      setError(err.message || 'Failed to load requirements');
      console.error('Error fetching requirements:', err);
    } finally {
      setLoading(false);
    }
  }, [project?.id]);

  useEffect(() => {
    if (hasRequirements) {
      fetchRequirements();
    }
  }, [hasRequirements, fetchRequirements]);

  // Calculate total count across all sections
  const getTotalCount = () => {
    if (!requirements) return 0;
    return SECTION_ORDER.reduce((total, section) => {
      return total + (requirements[section]?.length || 0);
    }, 0);
  };

  // Build subtitle showing item count and section breakdown
  const getSubtitle = () => {
    const totalCount = getTotalCount();
    const sectionsWithItems = SECTION_ORDER.filter(
      (section) => requirements?.[section]?.length > 0
    ).length;

    if (totalCount === 0) return 'No requirements added yet';

    const itemWord = totalCount === 1 ? 'item' : 'items';
    const sectionWord = sectionsWithItems === 1 ? 'section' : 'sections';
    return `${totalCount} ${itemWord} across ${sectionsWithItems} ${sectionWord}`;
  };

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
    setShowAddMeetingModal(true);
  };

  // Handle Save Requirements - called when requirements are saved from the modal
  const handleSaveRequirements = (savedCount) => {
    console.log('Requirements saved:', savedCount);
    setShowAddMeetingModal(false);
    // Refresh requirements list
    fetchRequirements();
  };

  // Handle Add Manually button click (from empty state or header)
  const handleAddManually = () => {
    setAddToSection(null);
    setShowAddManuallyModal(true);
  };

  // Handle Add button click from a specific section
  const handleAddToSection = (section) => {
    setAddToSection(section);
    setShowAddManuallyModal(true);
  };

  // Handle requirement added manually
  const handleRequirementAdded = (requirement) => {
    console.log('Requirement added:', requirement);
    // Refresh requirements list
    fetchRequirements();
  };

  // Handle save requirement (inline editing)
  const handleSaveRequirement = async (id, newContent) => {
    // Find the original requirement for rollback
    let originalContent = null;
    let sectionKey = null;
    for (const section of SECTION_ORDER) {
      const item = requirements?.[section]?.find(r => r.id === id);
      if (item) {
        originalContent = item.content;
        sectionKey = section;
        break;
      }
    }

    // Optimistic update
    if (sectionKey && requirements) {
      setRequirements(prev => ({
        ...prev,
        [sectionKey]: prev[sectionKey].map(item =>
          item.id === id ? { ...item, content: newContent } : item
        ),
      }));
    }

    try {
      await put(`/api/requirements/${id}`, { content: newContent });
    } catch (error) {
      // Rollback on error
      if (sectionKey && originalContent !== null) {
        setRequirements(prev => ({
          ...prev,
          [sectionKey]: prev[sectionKey].map(item =>
            item.id === id ? { ...item, content: originalContent } : item
          ),
        }));
      }
      console.error('Failed to save requirement:', error);
      throw error; // Re-throw so RequirementSection knows to keep edit mode open
    }
  };

  // Handle delete requirement (placeholder - will be implemented in P3-006)
  const handleDeleteRequirement = (id) => {
    console.log('Delete requirement:', id);
    // TODO: Implement delete confirmation (P3-006)
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
        {showAddMeetingModal && (
          <AddMeetingModal
            projectId={project?.id}
            onClose={() => setShowAddMeetingModal(false)}
            onSave={handleSaveRequirements}
          />
        )}
        {showAddManuallyModal && (
          <AddManuallyModal
            projectId={project?.id}
            onClose={() => setShowAddManuallyModal(false)}
            onAdd={handleRequirementAdded}
          />
        )}
      </div>
    );
  }

  // Loading state
  if (loading && !requirements) {
    return (
      <div className="stage-content stage-content--requirements">
        <div className="requirements-stage__loading">
          <div className="requirements-stage__loading-spinner" aria-label="Loading requirements">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25"/>
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <p className="requirements-stage__loading-text">Loading requirements...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !requirements) {
    return (
      <div className="stage-content stage-content--requirements">
        <div className="requirements-stage__error">
          <p className="requirements-stage__error-text">{error}</p>
          <button
            className="requirements-stage__retry-btn"
            onClick={fetchRequirements}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Requirements list view
  return (
    <div className="stage-content stage-content--requirements">
      {/* Stage Header with total count */}
      <StageHeader
        title="Requirements"
        subtitle={getSubtitle()}
        status={mapRequirementsStatus(project?.requirements_status)}
        statusLabel={getStatusLabel(project?.requirements_status)}
        actions={
          <>
            <button
              className="requirements-stage__action-btn"
              onClick={handleAddMeeting}
            >
              Add Meeting
            </button>
            <button
              className="requirements-stage__action-btn requirements-stage__action-btn--secondary"
              onClick={handleAddManually}
            >
              Add Manually
            </button>
          </>
        }
      />

      {/* Requirements Sections */}
      <div className="requirements-stage__sections">
        {SECTION_ORDER.map((section) => (
          <RequirementSection
            key={section}
            section={section}
            items={requirements?.[section] || []}
            onAdd={handleAddToSection}
            onSave={handleSaveRequirement}
            onDelete={handleDeleteRequirement}
            defaultExpanded={requirements?.[section]?.length > 0}
          />
        ))}
      </div>

      {/* Modals */}
      {showAddMeetingModal && (
        <AddMeetingModal
          projectId={project?.id}
          onClose={() => setShowAddMeetingModal(false)}
          onSave={handleSaveRequirements}
        />
      )}
      {showAddManuallyModal && (
        <AddManuallyModal
          projectId={project?.id}
          defaultSection={addToSection}
          onClose={() => {
            setShowAddManuallyModal(false);
            setAddToSection(null);
          }}
          onAdd={handleRequirementAdded}
        />
      )}
    </div>
  );
}

export default RequirementsStage;
