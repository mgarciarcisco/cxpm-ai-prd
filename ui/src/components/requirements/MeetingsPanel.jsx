import React, { useState, useEffect, useCallback } from 'react';
import { get } from '../../services/api';
import { CollapsibleSection } from '../common/CollapsibleSection';
import './MeetingsPanel.css';

/**
 * Format a date as relative time (e.g., "2 hours ago")
 */
function formatTimeAgo(dateString) {
  if (!dateString) return '';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/**
 * Get status badge color class
 */
function getStatusClass(status) {
  switch (status) {
    case 'processed':
      return 'meetings-panel__status--processed';
    case 'applied':
      return 'meetings-panel__status--applied';
    case 'processing':
      return 'meetings-panel__status--processing';
    case 'failed':
      return 'meetings-panel__status--failed';
    default:
      return 'meetings-panel__status--pending';
  }
}

/**
 * Get human-readable status label
 */
function getStatusLabel(status) {
  switch (status) {
    case 'processed':
      return 'Ready to Apply';
    case 'applied':
      return 'Applied';
    case 'processing':
      return 'Processing...';
    case 'failed':
      return 'Failed';
    case 'pending':
      return 'Pending';
    default:
      return status;
  }
}

/**
 * MeetingsPanel component - displays all meetings for a project
 */
function MeetingsPanel({ projectId, onViewMeeting }) {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(true);

  const fetchMeetings = useCallback(async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      setError(null);
      const data = await get(`/api/projects/${projectId}/meetings`);
      setMeetings(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load meetings');
      console.error('Error fetching meetings:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  if (loading && meetings.length === 0) {
    return null; // Don't show panel while loading initially
  }

  if (meetings.length === 0) {
    return null; // Don't show panel if no meetings
  }

  const meetingIcon = (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.667 2.667H3.333C2.597 2.667 2 3.264 2 4v9.333c0 .737.597 1.334 1.333 1.334h9.334c.736 0 1.333-.597 1.333-1.334V4c0-.736-.597-1.333-1.333-1.333z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10.667 1.333V4M5.333 1.333V4M2 6.667h12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  return (
    <div className="meetings-panel">
      <CollapsibleSection
        title={`Meetings (${meetings.length})`}
        icon={meetingIcon}
        defaultExpanded={expanded}
        onToggle={setExpanded}
      >
        <div className="meetings-panel__list">
          {error && (
            <div className="meetings-panel__error">
              {error}
              <button onClick={fetchMeetings} className="meetings-panel__retry">
                Retry
              </button>
            </div>
          )}

          {meetings.map((meeting) => (
            <div key={meeting.id} className="meetings-panel__item">
              <div className="meetings-panel__item-header">
                <span className="meetings-panel__item-title" title={meeting.title}>
                  {meeting.title || 'Untitled Meeting'}
                </span>
                <span className={`meetings-panel__status ${getStatusClass(meeting.status)}`}>
                  {getStatusLabel(meeting.status)}
                </span>
              </div>

              <div className="meetings-panel__item-meta">
                <span className="meetings-panel__item-date">
                  {formatTimeAgo(meeting.created_at)}
                </span>
                {meeting.status === 'processed' && (
                  <button
                    className="meetings-panel__view-btn"
                    onClick={() => onViewMeeting?.(meeting)}
                  >
                    View Items
                  </button>
                )}
                {meeting.status === 'failed' && meeting.error_message && (
                  <span className="meetings-panel__error-msg" title={meeting.error_message}>
                    {meeting.error_message.length > 30
                      ? meeting.error_message.substring(0, 30) + '...'
                      : meeting.error_message}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </CollapsibleSection>
    </div>
  );
}

export default MeetingsPanel;
