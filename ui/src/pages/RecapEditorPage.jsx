import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { get } from '../services/api';
import { useStreaming } from '../hooks/useStreaming';
import StreamingPreview from '../components/meetings/StreamingPreview';
import { RecapEditor } from '../components/meetings/RecapEditor';
import { Breadcrumbs } from '../components/common/Breadcrumbs';
import './RecapEditorPage.css';

/**
 * Section configuration for side navigation
 * Matches the sections in RecapEditor
 */
const SECTIONS = [
  { key: 'needs_and_goals', label: 'Needs & Goals', colorClass: 'needs-and-goals' },
  { key: 'requirements', label: 'Requirements', colorClass: 'requirements' },
  { key: 'scope_and_constraints', label: 'Scope & Constraints', colorClass: 'scope-and-constraints' },
  { key: 'risks_and_questions', label: 'Risks & Questions', colorClass: 'risks-and-questions' },
  { key: 'action_items', label: 'Action Items', colorClass: 'action-items' },
];

/**
 * Side Navigation component for section selection (tab-style)
 */
function SideNav({ sections, sectionCounts, activeSection, onSectionChange }) {
  return (
    <aside className="recap-side-nav">
      <div className="recap-side-nav__title">Sections</div>
      <ul className="recap-side-nav__list">
        {sections.map((section) => {
          const count = sectionCounts[section.key] || 0;
          const isActive = activeSection === section.key;
          const isEmpty = count === 0;
          return (
            <li key={section.key} className="recap-side-nav__item">
              <button
                type="button"
                onClick={() => onSectionChange(section.key)}
                className={`recap-side-nav__link ${isActive ? 'recap-side-nav__link--active' : ''}`}
              >
                <span>{section.label}</span>
                <span className={`recap-side-nav__count recap-side-nav__count--${isEmpty ? 'empty' : section.colorClass}`}>
                  {count}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

function RecapEditorPage() {
  const { id: projectId, mid } = useParams(); // projectId may be undefined for dashboard flow
  const navigate = useNavigate();
  const location = useLocation();
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [meetingItems, setMeetingItems] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('needs_and_goals');

  // Determine if we're in project context or standalone (dashboard) flow
  const hasProjectContext = Boolean(projectId);

  // Get jobId from navigation state or use meeting id
  const jobId = location.state?.job_id || mid;

  // Streaming hook for pending/processing meetings
  const { items: streamingItems, status: streamStatus, error: streamError, retry } = useStreaming(
    meeting?.status === 'pending' || meeting?.status === 'processing' ? jobId : null
  );

  // Calculate section counts from meetingItems
  const sectionCounts = useMemo(() => {
    const counts = {};
    SECTIONS.forEach((section) => {
      counts[section.key] = 0;
    });
    meetingItems.forEach((item) => {
      if (item.content && item.content.trim() && counts[item.section] !== undefined) {
        counts[item.section]++;
      }
    });
    return counts;
  }, [meetingItems]);

  // Calculate total item count
  const totalItemCount = useMemo(() => {
    return Object.values(sectionCounts).reduce((sum, count) => sum + count, 0);
  }, [sectionCounts]);

  // Handle section change from side nav
  const handleSectionChange = useCallback((sectionKey) => {
    setActiveSection(sectionKey);
  }, []);

  // Transition from streaming to processed state when streaming completes
  useEffect(() => {
    if (streamStatus === 'complete' && meeting?.status !== 'processed') {
      // Re-fetch meeting to get items with their database IDs
      // (streaming items don't have IDs, which breaks edit/delete)
      fetchMeeting();
    }
  }, [streamStatus, meeting?.status]);

  useEffect(() => {
    fetchMeeting();
  }, [mid]);

  const fetchMeeting = async () => {
    try {
      setLoading(true);
      setError(null);
      const meetingData = await get(`/api/meetings/${mid}`);
      setMeeting(meetingData);
      // Initialize meetingItems from meeting data if status is processed or applied
      if ((meetingData.status === 'processed' || meetingData.status === 'applied') && meetingData.items) {
        setMeetingItems(meetingData.items);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle item edit callback - update the item in local state
  const handleEditItem = useCallback((updatedItem) => {
    setMeetingItems(prev => prev.map(item =>
      item.id === updatedItem.id ? updatedItem : item
    ));
  }, []);

  // Handle item delete callback - remove item from local state
  const handleDeleteItem = useCallback((deletedItem) => {
    setMeetingItems(prev => prev.filter(item => item.id !== deletedItem.id));
  }, []);

  // Handle add item callback - add new item to local state
  const handleAddItem = useCallback((newItem) => {
    setMeetingItems(prev => [...prev, newItem]);
  }, []);

  // Handle Save & Apply - navigate to appropriate next step
  const handleSaveAndApply = () => {
    setIsSaving(true);
    if (hasProjectContext) {
      // Project flow: go directly to conflict resolution
      navigate(`/app/projects/${projectId}/meetings/${mid}/apply`);
    } else {
      // Dashboard flow: go to project selection first
      navigate(`/app/meetings/${mid}/select-project`);
    }
  };

  const handleRetry = async () => {
    // Call the retry endpoint to reset the meeting status
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:8000')}/api/meetings/${mid}/retry`,
        { method: 'POST' }
      );
      if (!response.ok) {
        throw new Error('Failed to retry extraction');
      }
      const updatedMeeting = await response.json();
      setMeeting(updatedMeeting);
      // The useStreaming hook will automatically start when meeting status changes to pending
    } catch (err) {
      setError(err.message);
    }
  };

  // Build breadcrumb items
  const breadcrumbItems = useMemo(() => {
    if (hasProjectContext) {
      return [
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Project', href: `/app/projects/${projectId}` },
        { label: 'Extraction Results' }
      ];
    }
    return [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Extraction Results' }
    ];
  }, [hasProjectContext, projectId]);

  // Determine the return URL for cancel
  const returnTo = hasProjectContext ? `/app/projects/${projectId}` : '/dashboard';

  if (loading) {
    return (
      <main className="main-content">
        <div className="recap-editor-loading">
          <div className="loading-spinner"></div>
          <p>Loading meeting...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="main-content">
        <div className="recap-editor-error">
          <p>Error loading meeting: {error}</p>
          <button onClick={fetchMeeting} className="retry-btn">Retry</button>
        </div>
      </main>
    );
  }

  // Determine what to show based on meeting status
  const showStreamingPreview = meeting?.status === 'pending' || meeting?.status === 'processing';
  const showRecapEditor = meeting?.status === 'processed' || meeting?.status === 'applied';
  const showFailedState = meeting?.status === 'failed';
  const isApplied = meeting?.status === 'applied';

  // Format meeting date
  const formattedDate = meeting?.meeting_date
    ? new Date(meeting.meeting_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    : null;

  return (
    <div className="recap-editor-page">
      {/* Sticky Header */}
      <header className="recap-sticky-header">
        <div className="recap-sticky-header__inner">
          <div className="recap-sticky-header__left">
            <Breadcrumbs items={breadcrumbItems} />
            <div className="recap-sticky-header__title-group">
              <h1 className="recap-sticky-header__title">{meeting?.title || 'Meeting Recap'}</h1>
              {formattedDate && (
                <span className="recap-sticky-header__date">{formattedDate}</span>
              )}
            </div>
          </div>
          {showRecapEditor && (
            <div className="recap-sticky-header__summary">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12z"/>
                <path d="M8 5v3l2 1"/>
              </svg>
              {totalItemCount} items extracted
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="recap-page-layout">
        {/* Side Navigation - only show when editing */}
        {showRecapEditor && (
          <SideNav
            sections={SECTIONS}
            sectionCounts={sectionCounts}
            activeSection={activeSection}
            onSectionChange={handleSectionChange}
          />
        )}

        {/* Main Content */}
        <main className={`recap-main-content ${!showRecapEditor ? 'recap-main-content--full-width' : ''}`}>
          {showStreamingPreview && (
            <div className="recap-content-card">
              <StreamingPreview
                items={streamingItems}
                status={streamStatus}
                error={streamError}
                onRetry={retry}
              />
            </div>
          )}

          {showRecapEditor && (
            <div className="recap-content-card">
              {isApplied && (
                <div className="recap-editor-applied-notice">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  <span>This meeting has been applied to requirements</span>
                </div>
              )}
              <RecapEditor
                meetingId={mid}
                items={meetingItems}
                activeSection={activeSection}
                onEditItem={handleEditItem}
                onDeleteItem={handleDeleteItem}
                onAddItem={handleAddItem}
                readOnly={isApplied}
              />
            </div>
          )}

          {showFailedState && (
            <div className="recap-content-card">
              <div className="recap-editor-failed">
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                <h3>Extraction Failed</h3>
                <p>{meeting?.error_message || 'An error occurred during extraction.'}</p>
                <button className="retry-btn" onClick={handleRetry}>
                  Try Again
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Sticky Footer - only show when editing and not applied */}
      {showRecapEditor && !isApplied && (
        <footer className="recap-sticky-footer">
          <div className="recap-sticky-footer__inner">
            <div className="recap-sticky-footer__summary">
              <strong>{totalItemCount} items</strong> across {Object.values(sectionCounts).filter(c => c > 0).length} categories ready to apply
            </div>
            <div className="recap-sticky-footer__actions">
              <Link to={returnTo} className="recap-btn recap-btn--secondary">
                Cancel
              </Link>
              <button
                className="recap-btn recap-btn--primary"
                onClick={handleSaveAndApply}
                disabled={isSaving}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13.5 4.5L6 12L2.5 8.5"/>
                </svg>
                {isSaving ? 'Saving...' : 'Save & Apply'}
              </button>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

export default RecapEditorPage;
