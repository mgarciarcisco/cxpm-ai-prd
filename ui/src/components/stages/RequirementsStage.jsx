import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '../common/EmptyState';
import { ConfirmationDialog } from '../common/ConfirmationDialog';
import { StageHeader } from '../stage/StageHeader';
import { StageActions } from '../stage/StageActions';
import { StageLoader } from './StageLoader';
import AddManuallyModal from '../requirements/AddManuallyModal';
import MeetingsPanel from '../requirements/MeetingsPanel';
import ViewMeetingModal from '../requirements/ViewMeetingModal';
import RequirementSection, { SECTION_ORDER } from '../requirements/RequirementSection';
import { get, put, patch, del } from '../../services/api';
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
function RequirementsStage({ project, onProjectUpdate }) {
  const navigate = useNavigate();
  const [showAddManuallyModal, setShowAddManuallyModal] = useState(false);
  const [showViewMeetingModal, setShowViewMeetingModal] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [addToSection, setAddToSection] = useState(null);
  const [requirements, setRequirements] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [markingAsReviewed, setMarkingAsReviewed] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState({ isOpen: false, item: null });
  const [isDeleting, setIsDeleting] = useState(false);
  const [meetingsPanelKey, setMeetingsPanelKey] = useState(0); // For refreshing meetings panel

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

  // Handle Add Meeting button click - navigate to full page upload view
  const handleAddMeeting = () => {
    const returnTo = encodeURIComponent(`/projects/${project.id}/requirements`);
    navigate(`/app/projects/${project.id}/meetings/new?returnTo=${returnTo}`);
  };

  // Handle Save Requirements - called when requirements are saved from the view meeting modal
  const handleSaveRequirements = (savedCount) => {
    console.log('Requirements saved:', savedCount);
    setShowViewMeetingModal(false);
    setSelectedMeeting(null);
    // Refresh requirements list
    fetchRequirements();
    // Refresh meetings panel
    setMeetingsPanelKey(prev => prev + 1);
    // Notify parent to refresh project data (status may have changed from empty to has_items)
    if (onProjectUpdate) {
      onProjectUpdate();
    }
  };

  // Handle View Meeting - opens modal to view/apply extracted items
  const handleViewMeeting = (meeting) => {
    setSelectedMeeting(meeting);
    setShowViewMeetingModal(true);
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
    // Notify parent to refresh project data (status may have changed from empty to has_items)
    if (onProjectUpdate) {
      onProjectUpdate();
    }
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

  // Handle delete requirement - show confirmation dialog
  const handleDeleteRequirement = (id) => {
    // Find the requirement to get its content for the confirmation message
    let itemToDelete = null;
    let sectionKey = null;
    for (const section of SECTION_ORDER) {
      const item = requirements?.[section]?.find(r => r.id === id);
      if (item) {
        itemToDelete = item;
        sectionKey = section;
        break;
      }
    }

    if (itemToDelete) {
      setDeleteConfirmation({
        isOpen: true,
        item: { ...itemToDelete, section: sectionKey },
      });
    }
  };

  // Close delete confirmation dialog
  const handleCancelDelete = () => {
    setDeleteConfirmation({ isOpen: false, item: null });
  };

  // Confirm and execute delete
  const handleConfirmDelete = async () => {
    const { item } = deleteConfirmation;
    if (!item) return;

    setIsDeleting(true);

    // Compute remaining count BEFORE optimistic update to avoid stale closure issue
    const remainingTotal = SECTION_ORDER.reduce((total, section) => {
      const sectionItems = section === item.section
        ? (requirements[section] || []).filter(r => r.id !== item.id)
        : (requirements[section] || []);
      return total + sectionItems.length;
    }, 0);

    // Optimistically remove from UI
    const originalRequirements = { ...requirements };
    setRequirements(prev => ({
      ...prev,
      [item.section]: prev[item.section].filter(r => r.id !== item.id),
    }));

    try {
      await del(`/api/requirements/${item.id}`);
      // Close dialog on success
      setDeleteConfirmation({ isOpen: false, item: null });

      // Notify parent to refresh project data if we deleted the last item
      if (remainingTotal === 0 && onProjectUpdate) {
        // Project status will change from has_items to empty
        onProjectUpdate();
      }
    } catch (error) {
      // Rollback on error
      setRequirements(originalRequirements);
      console.error('Failed to delete requirement:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle Mark as Reviewed - updates requirements_status to 'reviewed'
  const handleMarkAsReviewed = async () => {
    if (!project?.id) return;

    try {
      setMarkingAsReviewed(true);
      await patch(`/api/projects/${project.id}/stages/requirements`, { status: 'reviewed' });
      // Notify parent to refresh project data
      if (onProjectUpdate) {
        onProjectUpdate();
      }
    } catch (err) {
      console.error('Failed to mark as reviewed:', err);
    } finally {
      setMarkingAsReviewed(false);
    }
  };

  // Determine if requirements are already reviewed
  const isReviewed = project?.requirements_status === 'reviewed';

  // Empty state - no requirements yet
  if (!hasRequirements) {
    return (
      <div className="stage-content stage-content--requirements">
        {/* Show meetings panel even when no requirements */}
        <MeetingsPanel
          key={meetingsPanelKey}
          projectId={project?.id}
          onViewMeeting={handleViewMeeting}
        />

        <EmptyState
          icon={requirementsIcon}
          title="No requirements yet"
          description="Extract from a meeting or add manually"
          actions={[
            <button key="meeting" onClick={handleAddMeeting}>Add Meeting</button>,
            <button key="manual" className="secondary" onClick={handleAddManually}>Add Manually</button>
          ]}
        />
        {showAddManuallyModal && (
          <AddManuallyModal
            projectId={project?.id}
            onClose={() => setShowAddManuallyModal(false)}
            onAdd={handleRequirementAdded}
          />
        )}
        {showViewMeetingModal && selectedMeeting && (
          <ViewMeetingModal
            meeting={selectedMeeting}
            projectId={project?.id}
            onClose={() => {
              setShowViewMeetingModal(false);
              setSelectedMeeting(null);
            }}
            onSave={handleSaveRequirements}
          />
        )}
      </div>
    );
  }

  // Loading state
  if (loading && !requirements) {
    return (
      <div className="stage-content stage-content--requirements">
        <StageLoader message="Loading requirements..." stage="requirements" />
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

      {/* Meetings Panel */}
      <MeetingsPanel
        key={meetingsPanelKey}
        projectId={project?.id}
        onViewMeeting={handleViewMeeting}
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
      {showViewMeetingModal && selectedMeeting && (
        <ViewMeetingModal
          meeting={selectedMeeting}
          projectId={project?.id}
          onClose={() => {
            setShowViewMeetingModal(false);
            setSelectedMeeting(null);
          }}
          onSave={handleSaveRequirements}
        />
      )}

      {/* Stage Actions */}
      <StageActions
        primaryAction={
          isReviewed
            ? { label: 'Generate PRD', onClick: () => console.log('Generate PRD'), disabled: true }
            : { label: 'Mark as Reviewed', onClick: handleMarkAsReviewed, loading: markingAsReviewed }
        }
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={deleteConfirmation.isOpen}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title="Delete Requirement"
        message={
          deleteConfirmation.item
            ? `Are you sure you want to delete this requirement? "${deleteConfirmation.item.content.length > 100 ? deleteConfirmation.item.content.substring(0, 100) + '...' : deleteConfirmation.item.content}"`
            : 'Are you sure you want to delete this requirement?'
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        loading={isDeleting}
      />
    </div>
  );
}

export default RequirementsStage;
