import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ConfirmationDialog } from '../common/ConfirmationDialog';
import { StageLoader } from './StageLoader';
import AddManuallyModal from '../requirements/AddManuallyModal';
import AddMeetingModal from '../requirements/AddMeetingModal';
import { SECTION_ORDER, SECTION_LABELS } from '../requirements/RequirementSection';
import { get, put, patch, del } from '../../services/api';
import './RequirementsStage.css';

/**
 * Section icons and their background color classes
 */
const SECTION_ICONS = {
  problems: { icon: '!', colorClass: 'section-icon--problems' },
  user_goals: { icon: '>', colorClass: 'section-icon--user-goals' },
  functional_requirements: { icon: '#', colorClass: 'section-icon--functional' },
  data_needs: { icon: '@', colorClass: 'section-icon--data-needs' },
  constraints: { icon: '~', colorClass: 'section-icon--constraints' },
  non_goals: { icon: 'x', colorClass: 'section-icon--non-goals' },
  risks_assumptions: { icon: '*', colorClass: 'section-icon--risks' },
  open_questions: { icon: '?', colorClass: 'section-icon--questions' },
  action_items: { icon: '+', colorClass: 'section-icon--actions' },
};

/**
 * Map requirements status to status badge variant.
 */
function getStatusBadgeClass(status) {
  switch (status) {
    case 'reviewed':
      return 'status-badge--complete';
    case 'has_items':
      return 'status-badge--in-progress';
    default:
      return 'status-badge--empty';
  }
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
 * Format date for display
 */
function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Requirements stage content component with two-column layout.
 * Left sidebar: Project link, filter indicator, section navigation, meeting filters
 * Main content: Header with breadcrumbs, collapsible requirement sections, sticky footer
 */
function RequirementsStage({ project, onProjectUpdate }) {
  const navigate = useNavigate();
  const [showAddManuallyModal, setShowAddManuallyModal] = useState(false);
  const [showAddMeetingModal, setShowAddMeetingModal] = useState(false);
  const [addToSection, setAddToSection] = useState(null);
  const [requirements, setRequirements] = useState(null);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [meetingsLoading, setMeetingsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [markingAsReviewed, setMarkingAsReviewed] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState({ isOpen: false, item: null });
  const [isDeleting, setIsDeleting] = useState(false);
  const [expandedSections, setExpandedSections] = useState(new Set(SECTION_ORDER));
  const [selectedMeetingFilter, setSelectedMeetingFilter] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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

  // Fetch meetings
  const fetchMeetings = useCallback(async () => {
    if (!project?.id) return;

    try {
      setMeetingsLoading(true);
      const data = await get(`/api/projects/${project.id}/meetings`);
      setMeetings(data || []);
    } catch (err) {
      console.error('Error fetching meetings:', err);
    } finally {
      setMeetingsLoading(false);
    }
  }, [project?.id]);

  useEffect(() => {
    fetchRequirements();
    fetchMeetings();
  }, [fetchRequirements, fetchMeetings]);

  // Flatten all requirements into a single array with section info
  const allRequirements = useMemo(() => {
    if (!requirements) return [];
    const items = [];
    SECTION_ORDER.forEach((section) => {
      (requirements[section] || []).forEach((item) => {
        items.push({ ...item, section });
      });
    });
    return items;
  }, [requirements]);

  // Filter requirements by selected meeting
  const filteredRequirements = useMemo(() => {
    if (!selectedMeetingFilter) return allRequirements;
    return allRequirements.filter((item) =>
      item.sources?.some((source) => source.meeting_id === selectedMeetingFilter)
    );
  }, [allRequirements, selectedMeetingFilter]);

  // Group filtered requirements by section
  const filteredBySection = useMemo(() => {
    const grouped = {};
    SECTION_ORDER.forEach((section) => {
      grouped[section] = filteredRequirements.filter((item) => item.section === section);
    });
    return grouped;
  }, [filteredRequirements]);

  // Count items per meeting
  const meetingItemCounts = useMemo(() => {
    const counts = {};
    allRequirements.forEach((item) => {
      item.sources?.forEach((source) => {
        if (source.meeting_id) {
          counts[source.meeting_id] = (counts[source.meeting_id] || 0) + 1;
        }
      });
    });
    return counts;
  }, [allRequirements]);

  // Get selected meeting name for filter indicator
  const selectedMeetingName = useMemo(() => {
    if (!selectedMeetingFilter) return null;
    const meeting = meetings.find((m) => m.id === selectedMeetingFilter);
    return meeting?.title || 'Meeting';
  }, [selectedMeetingFilter, meetings]);

  const totalCount = allRequirements.length;
  const filteredCount = filteredRequirements.length;

  // Handle section toggle
  const toggleSection = (section) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  // Handle Add Meeting button click - opens modal
  const handleAddMeeting = () => {
    setShowAddMeetingModal(true);
  };

  // Handle meeting added from modal
  const handleMeetingAdded = () => {
    setShowAddMeetingModal(false);
    fetchRequirements();
    fetchMeetings();
    if (onProjectUpdate) {
      onProjectUpdate();
    }
  };

  // Handle Add Manually button click (from header)
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
  const handleRequirementAdded = () => {
    setShowAddManuallyModal(false);
    setAddToSection(null);
    fetchRequirements();
    if (onProjectUpdate) {
      onProjectUpdate();
    }
  };

  // Enter edit mode for an item
  const handleStartEdit = (item) => {
    setEditingId(item.id);
    setEditValue(item.content);
  };

  // Cancel edit mode
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue('');
    setIsSaving(false);
  };

  // Save edited content
  const handleSaveEdit = async () => {
    if (!editingId || isSaving) return;

    const trimmedValue = editValue.trim();
    const originalItem = allRequirements.find((i) => i.id === editingId);

    // Don't save if empty or unchanged
    if (!trimmedValue || (originalItem && trimmedValue === originalItem.content)) {
      handleCancelEdit();
      return;
    }

    setIsSaving(true);

    // Optimistic update
    const sectionKey = originalItem?.section;
    const originalContent = originalItem?.content;
    if (sectionKey && requirements) {
      setRequirements((prev) => ({
        ...prev,
        [sectionKey]: prev[sectionKey].map((item) =>
          item.id === editingId ? { ...item, content: trimmedValue } : item
        ),
      }));
    }

    try {
      await put(`/api/requirements/${editingId}`, { content: trimmedValue });
      handleCancelEdit();
    } catch (error) {
      // Rollback on error
      if (sectionKey && originalContent !== null) {
        setRequirements((prev) => ({
          ...prev,
          [sectionKey]: prev[sectionKey].map((item) =>
            item.id === editingId ? { ...item, content: originalContent } : item
          ),
        }));
      }
      console.error('Failed to save requirement:', error);
      setIsSaving(false);
    }
  };

  // Handle keyboard events in edit input
  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  // Handle delete requirement - show confirmation dialog
  const handleDeleteRequirement = (item) => {
    setDeleteConfirmation({
      isOpen: true,
      item: item,
    });
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

    // Optimistically remove from UI
    const originalRequirements = { ...requirements };
    setRequirements((prev) => ({
      ...prev,
      [item.section]: prev[item.section].filter((r) => r.id !== item.id),
    }));

    try {
      await del(`/api/requirements/${item.id}`);
      setDeleteConfirmation({ isOpen: false, item: null });

      // Notify parent if we deleted the last item
      const remainingTotal = SECTION_ORDER.reduce((total, section) => {
        const sectionItems =
          section === item.section
            ? (requirements[section] || []).filter((r) => r.id !== item.id)
            : requirements[section] || [];
        return total + sectionItems.length;
      }, 0);

      if (remainingTotal === 0 && onProjectUpdate) {
        onProjectUpdate();
      }
    } catch (error) {
      setRequirements(originalRequirements);
      console.error('Failed to delete requirement:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle Mark as Reviewed
  const handleMarkAsReviewed = async () => {
    if (!project?.id) return;

    try {
      setMarkingAsReviewed(true);
      await patch(`/api/projects/${project.id}/stages/requirements`, { status: 'reviewed' });
      if (onProjectUpdate) {
        onProjectUpdate();
      }
    } catch (err) {
      console.error('Failed to mark as reviewed:', err);
    } finally {
      setMarkingAsReviewed(false);
    }
  };

  // Clear meeting filter
  const clearMeetingFilter = () => {
    setSelectedMeetingFilter(null);
  };

  // Handle back to project
  const handleBackToProject = () => {
    navigate(`/projects/${project.id}`);
  };

  const isReviewed = project?.requirements_status === 'reviewed';

  // Loading state
  if (loading && !requirements) {
    return (
      <div className="requirements-stage">
        <StageLoader message="Loading requirements..." stage="requirements" />
      </div>
    );
  }

  // Error state
  if (error && !requirements) {
    return (
      <div className="requirements-stage">
        <div className="requirements-stage__error">
          <p className="requirements-stage__error-text">{error}</p>
          <button className="requirements-stage__retry-btn" onClick={fetchRequirements}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="requirements-stage">
      {/* Left Sidebar */}
      <aside className="requirements-sidebar">
        <div className="requirements-sidebar__header">
          <div className="requirements-sidebar__label">Project</div>
          <div className="requirements-sidebar__project">
            <Link to={`/projects/${project?.id}`}>{project?.name || 'Untitled Project'}</Link>
          </div>
        </div>

        {/* Active Filter Indicator */}
        {selectedMeetingFilter && (
          <div className="requirements-sidebar__filter-indicator">
            <div className="filter-indicator__label">Filtering by</div>
            <div className="filter-indicator__value">
              <span>{selectedMeetingName}</span>
              <button className="filter-indicator__clear" onClick={clearMeetingFilter}>
                Clear
              </button>
            </div>
          </div>
        )}

        {/* All Requirements */}
        <div className="requirements-sidebar__section">
          <button
            className={`sidebar-nav-item sidebar-nav-item--all ${!selectedMeetingFilter ? 'sidebar-nav-item--active' : ''}`}
            onClick={clearMeetingFilter}
          >
            <span className="sidebar-nav-item__icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M5 6h6M5 8h4M5 10h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
            <span className="sidebar-nav-item__label">All Requirements</span>
            <span className="sidebar-nav-item__count">{totalCount}</span>
          </button>
        </div>

        {/* By Section */}
        <div className="requirements-sidebar__section">
          <div className="requirements-sidebar__section-title">By Section</div>
          {SECTION_ORDER.map((section) => {
            const count = filteredBySection[section]?.length || 0;
            const isZero = count === 0;
            return (
              <a
                key={section}
                href={`#section-${section}`}
                className={`sidebar-nav-item ${isZero ? 'sidebar-nav-item--zero' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  const element = document.getElementById(`section-${section}`);
                  if (element) {
                    element.scrollIntoView({ behavior: 'smooth' });
                  }
                  if (!expandedSections.has(section)) {
                    toggleSection(section);
                  }
                }}
              >
                <span className={`sidebar-nav-item__section-icon ${SECTION_ICONS[section]?.colorClass || ''}`}>
                  {SECTION_ICONS[section]?.icon || ''}
                </span>
                <span className="sidebar-nav-item__label">{SECTION_LABELS[section]}</span>
                <span className="sidebar-nav-item__count">{count}</span>
              </a>
            );
          })}
        </div>

        {/* By Meeting */}
        <div className="requirements-sidebar__section">
          <div className="requirements-sidebar__section-title">By Meeting</div>
          {meetingsLoading && meetings.length === 0 ? (
            <div className="requirements-sidebar__loading">Loading...</div>
          ) : (
            <>
              {meetings.map((meeting) => {
                const count = meetingItemCounts[meeting.id] || 0;
                const isActive = selectedMeetingFilter === meeting.id;
                return (
                  <button
                    key={meeting.id}
                    className={`sidebar-meeting-item ${isActive ? 'sidebar-meeting-item--active' : ''}`}
                    onClick={() =>
                      setSelectedMeetingFilter(isActive ? null : meeting.id)
                    }
                  >
                    <span className="sidebar-meeting-item__icon">
                      <svg viewBox="0 0 16 16" fill="none" width="16" height="16">
                        <rect
                          x="2"
                          y="3"
                          width="12"
                          height="11"
                          rx="2"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                        <path d="M2 6h12" stroke="currentColor" strokeWidth="1.5" />
                        <path
                          d="M5 1v3M11 1v3"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                    <div className="sidebar-meeting-item__content">
                      <div className="sidebar-meeting-item__name">{meeting.title || 'Untitled'}</div>
                      <div className="sidebar-meeting-item__meta">{formatDate(meeting.meeting_date)}</div>
                    </div>
                    <span className="sidebar-meeting-item__count">{count}</span>
                  </button>
                );
              })}
              <button className="sidebar-add-meeting-btn" onClick={handleAddMeeting}>
                <svg viewBox="0 0 16 16" fill="none" width="16" height="16">
                  <path
                    d="M8 3v10M3 8h10"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                Add Meeting
              </button>
            </>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="requirements-main">
        {/* Sticky Header */}
        <header className="requirements-header">
          <nav className="requirements-breadcrumbs">
            <Link to="/dashboard">Dashboard</Link>
            <span>/</span>
            <Link to={`/projects/${project?.id}`}>{project?.name || 'Untitled Project'}</Link>
            <span>/</span>
            <span>Requirements</span>
          </nav>
          <div className="requirements-header__row">
            <div className="requirements-header__left">
              <h1 className="requirements-header__title">
                Requirements
                <span className="requirements-header__count">
                  {selectedMeetingFilter ? `${filteredCount} of ${totalCount} items` : `${totalCount} items`}
                </span>
              </h1>
              <span className={`requirements-status-badge ${getStatusBadgeClass(project?.requirements_status)}`}>
                {getStatusLabel(project?.requirements_status)}
              </span>
            </div>
            <div className="requirements-header__actions">
              <button className="requirements-btn requirements-btn--secondary" onClick={handleAddManually}>
                <svg viewBox="0 0 16 16" fill="none" width="16" height="16">
                  <path
                    d="M8 3v10M3 8h10"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                Add Manually
              </button>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="requirements-content">
          {SECTION_ORDER.map((section) => {
            const items = filteredBySection[section] || [];
            const isExpanded = expandedSections.has(section);
            const isEmpty = items.length === 0;

            return (
              <div
                key={section}
                id={`section-${section}`}
                className={`requirements-section-card ${isExpanded ? 'requirements-section-card--expanded' : ''} ${isEmpty ? 'requirements-section-card--empty' : ''}`}
              >
                <button
                  className="requirements-section-header"
                  onClick={() => toggleSection(section)}
                  aria-expanded={isExpanded}
                >
                  <svg className="requirements-section-chevron" viewBox="0 0 20 20" fill="none">
                    <path
                      d="M7 5l5 5-5 5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className={`requirements-section-icon ${SECTION_ICONS[section]?.colorClass || ''}`}>
                    {SECTION_ICONS[section]?.icon || ''}
                  </span>
                  <span className="requirements-section-title">{SECTION_LABELS[section]}</span>
                  <span className="requirements-section-count">{items.length}</span>
                  <button
                    className="requirements-section-add-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddToSection(section);
                    }}
                  >
                    <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
                      <path
                        d="M8 3v10M3 8h10"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                    Add
                  </button>
                </button>
                {isExpanded && (
                  <div className="requirements-section-content">
                    {items.length === 0 ? (
                      <div className="requirements-section-empty">No items in this section</div>
                    ) : (
                      <ul className="requirements-list">
                        {items.map((item) => {
                          const isEditing = editingId === item.id;
                          const sourceMeeting = item.sources?.[0];
                          return (
                            <li
                              key={item.id}
                              className={`requirements-item ${isEditing ? 'requirements-item--editing' : ''}`}
                            >
                              <span className="requirements-item__bullet">-</span>
                              <div className="requirements-item__content">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    className="requirements-item__edit-input"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onKeyDown={handleEditKeyDown}
                                    onBlur={handleSaveEdit}
                                    disabled={isSaving}
                                    autoFocus
                                  />
                                ) : (
                                  <>
                                    <div className="requirements-item__text">{item.content}</div>
                                    {sourceMeeting?.meeting_title && (
                                      <span className="requirements-item__source">
                                        <svg viewBox="0 0 16 16" fill="none" width="12" height="12">
                                          <rect
                                            x="2"
                                            y="3"
                                            width="12"
                                            height="11"
                                            rx="2"
                                            stroke="currentColor"
                                            strokeWidth="1.5"
                                          />
                                        </svg>
                                        {sourceMeeting.meeting_title}
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                              {isEditing ? (
                                <div className="requirements-item__edit-actions">
                                  {isSaving && (
                                    <span className="requirements-item__saving">
                                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                        <circle
                                          cx="7"
                                          cy="7"
                                          r="6"
                                          stroke="currentColor"
                                          strokeWidth="1.5"
                                          strokeOpacity="0.25"
                                        />
                                        <path
                                          d="M7 1a6 6 0 0 1 6 6"
                                          stroke="currentColor"
                                          strokeWidth="1.5"
                                          strokeLinecap="round"
                                        />
                                      </svg>
                                    </span>
                                  )}
                                  <span className="requirements-item__edit-hint">
                                    Enter to save, Esc to cancel
                                  </span>
                                </div>
                              ) : (
                                <div className="requirements-item__actions">
                                  <button
                                    className="requirements-action-btn"
                                    onClick={() => handleStartEdit(item)}
                                    title="Edit"
                                  >
                                    <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
                                      <path
                                        d="M11.5 2.5l2 2M2 14l1-4 8-8 2 2-8 8-3 2z"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                  </button>
                                  <button
                                    className="requirements-action-btn requirements-action-btn--delete"
                                    onClick={() => handleDeleteRequirement(item)}
                                    title="Delete"
                                  >
                                    <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
                                      <path
                                        d="M2 4h12M5.5 4V2.5h5V4M6 7v5M10 7v5M3.5 4l.5 9.5a1 1 0 001 .5h6a1 1 0 001-.5l.5-9.5"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                  </button>
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Sticky Footer */}
        <footer className="requirements-footer">
          <div className="requirements-footer__info">
            {selectedMeetingFilter
              ? `Showing ${filteredCount} of ${totalCount} requirements from "${selectedMeetingName}"`
              : `${totalCount} requirements total`}
          </div>
          <div className="requirements-footer__actions">
            <button className="requirements-btn requirements-btn--secondary" onClick={handleBackToProject}>
              Back to Project
            </button>
            {!isReviewed && totalCount > 0 && (
              <button
                className="requirements-btn requirements-btn--success"
                onClick={handleMarkAsReviewed}
                disabled={markingAsReviewed}
              >
                {markingAsReviewed ? 'Marking...' : 'Mark as Reviewed'}
              </button>
            )}
          </div>
        </footer>
      </main>

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
      {showAddMeetingModal && (
        <AddMeetingModal
          projectId={project?.id}
          onClose={() => setShowAddMeetingModal(false)}
          onSave={handleMeetingAdded}
        />
      )}
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
