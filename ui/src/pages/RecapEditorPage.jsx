import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { get } from '../services/api';
import { useStreaming } from '../hooks/useStreaming';
import StreamingPreview from '../components/meetings/StreamingPreview';
import './RecapEditorPage.css';

function RecapEditorPage() {
  const { id, mid } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Get jobId from navigation state or use meeting id
  const jobId = location.state?.job_id || mid;

  // Streaming hook for pending/processing meetings
  const { items, status: streamStatus, error: streamError, retry } = useStreaming(
    meeting?.status === 'pending' || meeting?.status === 'processing' ? jobId : null
  );

  useEffect(() => {
    fetchMeeting();
  }, [mid]);

  const fetchMeeting = async () => {
    try {
      setLoading(true);
      setError(null);
      const meetingData = await get(`/api/meetings/${mid}`);
      setMeeting(meetingData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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
              items={items}
              status={streamStatus}
              error={streamError}
              onRetry={retry}
            />
          )}

          {showRecapEditor && (
            <div className="recap-editor-placeholder">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M38 8H10C7.79086 8 6 9.79086 6 12V38C6 40.2091 7.79086 42 10 42H38C40.2091 42 42 40.2091 42 38V12C42 9.79086 40.2091 8 38 8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 16H32" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 24H32" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 32H26" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <h3>Extraction Complete</h3>
              <p>
                {meeting?.items?.length || 0} item{meeting?.items?.length !== 1 ? 's' : ''} extracted.
                The full recap editor will be available in a future update.
              </p>
            </div>
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
