import React from 'react';
import './MeetingComponents.css';

/**
 * Helper function to count words in a string
 * @param {string} text - The text to count words in
 * @returns {number} - The number of words
 */
const countWords = (text) => {
  if (!text || typeof text !== 'string') return 0;
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
};

/**
 * Format word count for display
 * @param {number} count - The word count
 * @returns {string} - Formatted word count string
 */
const formatWordCount = (count) => {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return count.toLocaleString();
};

/**
 * MeetingCard component for displaying individual meeting items
 * in the requirements extraction redesign.
 *
 * Supports collapsed and expanded states:
 * - Collapsed: Shows name, date, word counts, and action buttons
 * - Expanded: Shows editable transcript and notes textareas
 *
 * @param {object} props
 * @param {object} props.meeting - Meeting data { id, name, date, transcript, notes }
 * @param {boolean} props.isExpanded - Whether the card is in expanded state
 * @param {function} props.onToggleExpand - Callback when expand/collapse is clicked
 * @param {function} props.onRemove - Callback when remove button is clicked
 * @param {function} props.onUpdate - Callback when meeting data is updated (receives updates object)
 */
function MeetingCard({ meeting, isExpanded, onToggleExpand, onRemove, onUpdate }) {
  const { id, name, date, transcript, notes } = meeting;

  const transcriptWordCount = countWords(transcript);
  const notesWordCount = countWords(notes);

  // Format the date for display
  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const handleTranscriptChange = (e) => {
    onUpdate({ transcript: e.target.value });
  };

  const handleNotesChange = (e) => {
    onUpdate({ notes: e.target.value });
  };

  return (
    <div className={`meeting-card ${isExpanded ? 'meeting-card--expanded' : ''}`}>
      <div className="meeting-card__header">
        <div className="meeting-card__info">
          <div className="meeting-card__icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
          </div>
          <div>
            <div className="meeting-card__name">{name}</div>
            {date && <div className="meeting-card__meta">{formatDate(date)}</div>}
          </div>
        </div>
        <div className="meeting-card__actions">
          <button
            type="button"
            className="meeting-card__action-btn"
            onClick={onToggleExpand}
          >
            {isExpanded ? 'Collapse' : 'Expand'}
          </button>
          <button
            type="button"
            className="meeting-card__action-btn meeting-card__action-btn--remove"
            onClick={onRemove}
          >
            Remove
          </button>
        </div>
      </div>

      {!isExpanded && (
        <div className="meeting-card__stats">
          <span className="meeting-card__stat">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <path d="M14 2v6h6" />
            </svg>
            Transcript: {formatWordCount(transcriptWordCount)} words
          </span>
          {notesWordCount > 0 && (
            <span className="meeting-card__stat">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              Notes: {formatWordCount(notesWordCount)} words
            </span>
          )}
        </div>
      )}

      {isExpanded && (
        <div className="meeting-card__expanded-content">
          <div className="meeting-card__field">
            <label className="meeting-card__field-label" htmlFor={`transcript-${id}`}>
              Transcript
            </label>
            <textarea
              id={`transcript-${id}`}
              className="meeting-card__field-textarea"
              value={transcript || ''}
              onChange={handleTranscriptChange}
              rows={4}
              placeholder="Meeting transcript content..."
            />
          </div>
          <div className="meeting-card__field">
            <label className="meeting-card__field-label" htmlFor={`notes-${id}`}>
              Notes (optional)
            </label>
            <textarea
              id={`notes-${id}`}
              className="meeting-card__field-textarea"
              value={notes || ''}
              onChange={handleNotesChange}
              rows={2}
              placeholder="Add any additional context or notes..."
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default MeetingCard;
