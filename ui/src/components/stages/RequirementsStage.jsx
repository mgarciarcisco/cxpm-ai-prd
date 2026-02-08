import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ConfirmationDialog } from '../common/ConfirmationDialog';
import { StageLoader } from './StageLoader';
import AddManuallyModal from '../requirements/AddManuallyModal';
import { SECTION_ORDER, SECTION_LABELS } from '../requirements/RequirementSection';
import { get, put, patch, del } from '../../services/api';
import './RequirementsStage.css';

/**
 * Section icons (professional SVGs), color classes, and colors for distribution bar.
 */
const SECTION_ICONS = {
  problems: {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    colorClass: 'section-icon--problems',
    color: '#dc2626',
  },
  user_goals: {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
      </svg>
    ),
    colorClass: 'section-icon--user-goals',
    color: '#16a34a',
  },
  functional_requirements: {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
    colorClass: 'section-icon--functional',
    color: '#2563eb',
  },
  data_needs: {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      </svg>
    ),
    colorClass: 'section-icon--data-needs',
    color: '#9333ea',
  },
  constraints: {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
    colorClass: 'section-icon--constraints',
    color: '#d97706',
  },
  non_goals: {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
      </svg>
    ),
    colorClass: 'section-icon--non-goals',
    color: '#6b7280',
  },
  risks_assumptions: {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
    colorClass: 'section-icon--risks',
    color: '#db2777',
  },
  open_questions: {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    colorClass: 'section-icon--questions',
    color: '#0d9488',
  },
  action_items: {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
    colorClass: 'section-icon--actions',
    color: '#ea580c',
  },
};

/**
 * Shorter labels for tab display
 */
const TAB_LABELS = {
  problems: 'Problems',
  user_goals: 'Goals',
  functional_requirements: 'Functional',
  data_needs: 'Data',
  constraints: 'Constraints',
  non_goals: 'Non-Goals',
  risks_assumptions: 'Risks',
  open_questions: 'Questions',
  action_items: 'Actions',
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
  const [addToSection, setAddToSection] = useState(null);
  const [requirements, setRequirements] = useState(null);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [meetingsLoading, setMeetingsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [markingAsReviewed, setMarkingAsReviewed] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState({ isOpen: false, item: null });
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeSection, setActiveSection] = useState(SECTION_ORDER[0]);
  const [visibleCount, setVisibleCount] = useState(8);
  const [selectedMeetingFilter, setSelectedMeetingFilter] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Reset pagination when active section or meeting filter changes
  useEffect(() => {
    setVisibleCount(8);
  }, [activeSection, selectedMeetingFilter]);

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

  // Handle Add Meeting button click - navigate to dedicated upload page
  const handleAddMeeting = () => {
    navigate(`/app/projects/${project.id}/meetings/new`);
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
      {/* Left Sidebar (slim: brand + project + distribution + meetings) */}
      <aside className="requirements-sidebar">
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-brand__mark">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <div className="sidebar-brand__text">
            <span className="sidebar-brand__name">CX AI Assistant</span>
            <span className="sidebar-brand__sub">for Product Managers</span>
          </div>
        </div>

        {/* Project */}
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

        {/* Distribution Summary */}
        {totalCount > 0 && (
          <div className="sidebar-distribution">
            <div className="sidebar-distribution__title">Distribution</div>
            <div className="sidebar-distribution__bar">
              {SECTION_ORDER.map((section, idx) => {
                const count = filteredBySection[section]?.length || 0;
                const percentage = totalCount > 0 ? (count / totalCount) * 100 : 0;
                const isFirst = idx === 0;
                const isLast = idx === SECTION_ORDER.length - 1;
                return percentage > 0 ? (
                  <div
                    key={section}
                    className="sidebar-distribution__segment"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: SECTION_ICONS[section]?.color || '#9ca3af',
                      borderRadius: isFirst ? '4px 0 0 4px' : isLast ? '0 4px 4px 0' : '0',
                    }}
                  />
                ) : null;
              })}
            </div>
            <div className="sidebar-distribution__stats">
              {SECTION_ORDER.slice(0, 4).map((section) => (
                <div key={section} className="sidebar-distribution__stat">
                  <span
                    className="sidebar-distribution__dot"
                    style={{ backgroundColor: SECTION_ICONS[section]?.color || '#9ca3af' }}
                  />
                  <span className="sidebar-distribution__stat-label">{TAB_LABELS[section]}</span>
                  <span className="sidebar-distribution__stat-count">
                    {filteredBySection[section]?.length || 0}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

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
                        <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M2 6h12" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M5 1v3M11 1v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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
                  <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Add Meeting
              </button>
            </>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="requirements-main">
        {/* Sticky Header with Tabs */}
        <header className="requirements-header">
          <div className="requirements-header__top">
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
            </div>
          </div>

          {/* Section Tabs */}
          <div className="section-tabs">
            {SECTION_ORDER.map((section) => {
              const count = filteredBySection[section]?.length || 0;
              const isActive = activeSection === section;
              return (
                <button
                  key={section}
                  className={`section-tab ${isActive ? 'section-tab--active' : ''} ${count === 0 ? 'section-tab--zero' : ''}`}
                  onClick={() => setActiveSection(section)}
                >
                  <span className={`section-tab__icon ${SECTION_ICONS[section]?.colorClass || ''}`}>
                    {SECTION_ICONS[section]?.icon}
                  </span>
                  {TAB_LABELS[section]}
                  <span className="section-tab__count">{count}</span>
                </button>
              );
            })}
          </div>
        </header>

        {/* Content Area - Single Section View */}
        <div className="requirements-content">
          {(() => {
            const items = filteredBySection[activeSection] || [];
            return (
              <div className="section-detail">
                <div className="section-detail__header">
                  <div className="section-detail__header-left">
                    <span className={`section-detail__icon ${SECTION_ICONS[activeSection]?.colorClass || ''}`}>
                      {SECTION_ICONS[activeSection]?.icon}
                    </span>
                    <span className="section-detail__title">{SECTION_LABELS[activeSection]}</span>
                    <span className="section-detail__count">{items.length} items</span>
                  </div>
                  <button
                    className="section-detail__add-btn"
                    onClick={() => handleAddToSection(activeSection)}
                  >
                    <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
                      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    Add to {SECTION_LABELS[activeSection]}
                  </button>
                </div>

                {items.length === 0 ? (
                  <div className="section-detail__empty">
                    {selectedMeetingFilter
                      ? `No ${SECTION_LABELS[activeSection].toLowerCase()} from this meeting`
                      : `No ${SECTION_LABELS[activeSection].toLowerCase()} yet`}
                  </div>
                ) : (
                  <div className="section-detail__list">
                    <ul className="requirements-list">
                      {items.slice(0, visibleCount).map((item, index) => {
                        const isEditing = editingId === item.id;
                        const sourceMeeting = item.sources?.[0];
                        return (
                          <li
                            key={item.id}
                            className={`requirements-item ${isEditing ? 'requirements-item--editing' : ''}`}
                          >
                            <span className="requirements-item__number">{index + 1}</span>
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
                                        <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
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
                                      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.25" />
                                      <path d="M7 1a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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
                    {visibleCount < items.length && (
                      <button
                        className="section-detail__show-more"
                        onClick={() => setVisibleCount((prev) => prev + 8)}
                      >
                        Show More ({items.length - visibleCount} remaining)
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
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
