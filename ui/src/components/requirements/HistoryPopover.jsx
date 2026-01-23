import { useState, useEffect, useRef } from 'react';
import { get } from '../../services/api';
import './HistoryPopover.css';

/**
 * HistoryPopover component for displaying requirement change history
 * Opens a popover/dropdown when the history icon is clicked
 * Fetches history from GET /api/requirements/{id}/history
 */
export function HistoryPopover({ requirementId }) {
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const popoverRef = useRef(null);
  const buttonRef = useRef(null);

  // Fetch history when popover opens
  useEffect(() => {
    if (isOpen && requirementId) {
      fetchHistory();
    }
  }, [isOpen, requirementId]);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await get(`/api/requirements/${requirementId}/history`);
      setHistory(data);
    } catch (err) {
      setError(err.message || 'Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (e) => {
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  };

  /**
   * Format actor for display
   * Converts actor enum values to human-readable labels
   */
  const formatActor = (actor) => {
    const actorLabels = {
      system: 'System',
      user: 'User',
      ai_extraction: 'AI Extraction',
      ai_merge: 'AI Merge'
    };
    return actorLabels[actor] || actor;
  };

  /**
   * Format action for display
   * Converts action enum values to human-readable labels
   */
  const formatAction = (action) => {
    const actionLabels = {
      created: 'Created',
      modified: 'Modified',
      deactivated: 'Deactivated',
      reactivated: 'Reactivated',
      merged: 'Merged'
    };
    return actionLabels[action] || action;
  };

  /**
   * Format date for display
   */
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="history-popover-container">
      <button
        ref={buttonRef}
        className="history-popover-trigger"
        onClick={handleToggle}
        aria-label="View history"
        aria-expanded={isOpen}
        type="button"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M8 14C11.3137 14 14 11.3137 14 8C14 4.68629 11.3137 2 8 2C4.68629 2 2 4.68629 2 8C2 11.3137 4.68629 14 8 14Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M8 4.5V8L10.5 9.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen && (
        <div ref={popoverRef} className="history-popover">
          <div className="history-popover-header">
            <h4 className="history-popover-title">Change History</h4>
            <button
              className="history-popover-close"
              onClick={() => setIsOpen(false)}
              aria-label="Close history"
              type="button"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M10.5 3.5L3.5 10.5M3.5 3.5L10.5 10.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          <div className="history-popover-content">
            {loading && (
              <div className="history-popover-loading">
                <div className="history-popover-spinner"></div>
                <span>Loading history...</span>
              </div>
            )}

            {error && (
              <div className="history-popover-error">
                <span>{error}</span>
                <button onClick={fetchHistory} className="history-popover-retry">
                  Retry
                </button>
              </div>
            )}

            {!loading && !error && history.length === 0 && (
              <div className="history-popover-empty">
                No history available
              </div>
            )}

            {!loading && !error && history.length > 0 && (
              <ul className="history-popover-list">
                {history.map((entry) => (
                  <li key={entry.id} className="history-popover-item">
                    <div className="history-popover-item-header">
                      <span className={`history-popover-action history-popover-action--${entry.action}`}>
                        {formatAction(entry.action)}
                      </span>
                      <span className="history-popover-actor">
                        by {formatActor(entry.actor)}
                      </span>
                    </div>
                    <div className="history-popover-item-date">
                      {formatDate(entry.created_at)}
                    </div>
                    {(entry.old_content || entry.new_content) && (
                      <div className="history-popover-item-changes">
                        {entry.old_content && (
                          <div className="history-popover-change history-popover-change--old">
                            <span className="history-popover-change-label">Before:</span>
                            <span className="history-popover-change-text">{entry.old_content}</span>
                          </div>
                        )}
                        {entry.new_content && (
                          <div className="history-popover-change history-popover-change--new">
                            <span className="history-popover-change-label">After:</span>
                            <span className="history-popover-change-text">{entry.new_content}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default HistoryPopover;
