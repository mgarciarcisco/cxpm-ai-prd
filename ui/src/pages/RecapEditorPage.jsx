import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { get } from '../services/api';
import { useStreaming } from '../hooks/useStreaming';
import StreamingPreview from '../components/meetings/StreamingPreview';
import { RecapEditor } from '../components/meetings/RecapEditor';
import './RecapEditorPage.css';

function RecapEditorPage() {
  const { id, mid } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [meetingItems, setMeetingItems] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  // Get jobId from navigation state or use meeting id
  const jobId = location.state?.job_id || mid;

  // Streaming hook for pending/processing meetings
  const { items: streamingItems, status: streamStatus, error: streamError, retry } = useStreaming(
    meeting?.status === 'pending' || meeting?.status === 'processing' ? jobId : null
  );

  // Transition from streaming to processed state when streaming completes
  useEffect(() => {
    if (streamStatus === 'complete' && meeting?.status !== 'processed') {
      // Update meeting status and set items from streaming
      setMeeting(prev => prev ? { ...prev, status: 'processed' } : prev);
      setMeetingItems(streamingItems);
    }
  }, [streamStatus, meeting?.status, streamingItems]);

  useEffect(() => {
    fetchMeeting();
  }, [mid]);

  const fetchMeeting = async () => {
    try {
      setLoading(true);
      setError(null);
      const meetingData = await get(`/api/meetings/${mid}`);
      setMeeting(meetingData);
      // Initialize meetingItems from meeting data if status is processed
      if (meetingData.status === 'processed' && meetingData.items) {
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

  // Handle item reorder callback - update order in local state
  const handleReorderItems = useCallback((section, newItemIds) => {
    setMeetingItems(prev => {
      // Get items not in this section
      const otherItems = prev.filter(item => item.section !== section);
      // Get items in this section and reorder them
      const sectionItems = prev.filter(item => item.section === section);
      const reorderedSectionItems = newItemIds.map((itemId, index) => {
        const item = sectionItems.find(i => i.id === itemId);
        return item ? { ...item, order: index + 1 } : null;
      }).filter(Boolean);
      return [...otherItems, ...reorderedSectionItems];
    });
  }, []);

  // Handle add item callback - add new item to local state
  const handleAddItem = useCallback((newItem) => {
    setMeetingItems(prev => [...prev, newItem]);
  }, []);

  // Handle Save & Apply - navigate to apply/conflict resolver page
  const handleSaveAndApply = () => {
    setIsSaving(true);
    navigate(`/app/projects/${id}/meetings/${mid}/apply`);
  };

  const handleRetry = async () => {
    // Call the retry endpoint to reset the meeting status
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/meetings/${mid}/retry`,
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
  const showRecapEditor = meeting?.status === 'processed';
  const showFailedState = meeting?.status === 'failed';

  return (
    <main className="main-content">
      <section className="recap-editor-section">
        <div className="section-header">
          <h2>{meeting?.title || 'Meeting Recap'}</h2>
          <Link to={`/app/projects/${id}`} className="back-link">Back to Project</Link>
        </div>

        {meeting?.meeting_date && (
          <p className="recap-editor-date">
            Meeting Date: {new Date(meeting.meeting_date).toLocaleDateString()}
          </p>
        )}

        <div className="recap-editor-content">
          {showStreamingPreview && (
            <StreamingPreview
              items={streamingItems}
              status={streamStatus}
              error={streamError}
              onRetry={retry}
            />
          )}

          {showRecapEditor && (
            <>
              <RecapEditor
                meetingId={mid}
                items={meetingItems}
                onEditItem={handleEditItem}
                onDeleteItem={handleDeleteItem}
                onReorderItems={handleReorderItems}
                onAddItem={handleAddItem}
              />
              <div className="recap-editor-actions">
                <button
                  className="save-apply-btn"
                  onClick={handleSaveAndApply}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save & Apply'}
                </button>
              </div>
            </>
          )}

          {showFailedState && (
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
          )}
        </div>
      </section>
    </main>
  );
}

export default RecapEditorPage;
