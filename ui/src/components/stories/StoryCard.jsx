import { useState } from 'react';
import Modal from '../common/Modal';
import './StoryCard.css';

/**
 * StoryCard component displays a single user story with expand/collapse functionality.
 *
 * @param {Object} story - The user story data
 * @param {string} story.id - UUID of the story
 * @param {string} story.story_id - Formatted story ID (e.g., "US-001")
 * @param {string} story.title - Story title
 * @param {string} story.description - Story description
 * @param {Array<string>} story.acceptance_criteria - List of acceptance criteria
 * @param {string} story.size - Story size (XS, S, M, L, XL)
 * @param {Array<string>} story.labels - List of labels
 * @param {string} story.status - Story status (draft, ready, exported)
 * @param {string} story.format - Story format (classic, job_story)
 * @param {function} onEdit - Callback when edit button is clicked
 * @param {function} onDelete - Callback when story is deleted
 * @param {boolean} defaultExpanded - Whether the card starts expanded (default: false)
 */
export function StoryCard({
  story,
  onEdit,
  onDelete,
  defaultExpanded = false,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!onDelete) return;

    try {
      setIsDeleting(true);
      await onDelete(story.id);
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error('Failed to delete story:', err);
      // Keep modal open on error
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditClick = (e) => {
    e.stopPropagation();
    if (onEdit) {
      onEdit(story);
    }
  };

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const toggleExpanded = () => {
    setExpanded(!expanded);
  };

  // Size color mapping
  const getSizeColor = (size) => {
    switch (size?.toUpperCase()) {
      case 'XS':
        return 'story-card-size--xs';
      case 'S':
        return 'story-card-size--s';
      case 'M':
        return 'story-card-size--m';
      case 'L':
        return 'story-card-size--l';
      case 'XL':
        return 'story-card-size--xl';
      default:
        return 'story-card-size--m';
    }
  };

  // Status color mapping
  const getStatusClass = (status) => {
    switch (status?.toLowerCase()) {
      case 'ready':
        return 'story-card-status--ready';
      case 'exported':
        return 'story-card-status--exported';
      case 'draft':
      default:
        return 'story-card-status--draft';
    }
  };

  return (
    <>
      <div className={`story-card ${expanded ? 'story-card--expanded' : ''}`}>
        {/* Header - Click to expand/collapse */}
        <div className="story-card-header" onClick={toggleExpanded}>
          <div className="story-card-header-left">
            {/* Story ID Badge */}
            <span className="story-card-id">{story.story_id}</span>

            {/* Title */}
            <span className="story-card-title">{story.title}</span>
          </div>

          <div className="story-card-header-right">
            {/* Labels */}
            {story.labels && story.labels.length > 0 && (
              <div className="story-card-labels">
                {story.labels.slice(0, 3).map((label, index) => (
                  <span key={index} className="story-card-label">
                    {label}
                  </span>
                ))}
                {story.labels.length > 3 && (
                  <span className="story-card-label story-card-label--more">
                    +{story.labels.length - 3}
                  </span>
                )}
              </div>
            )}

            {/* Size Indicator */}
            <span className={`story-card-size ${getSizeColor(story.size)}`}>
              {(story.size || 'm').toUpperCase()}
            </span>

            {/* Expand/Collapse Icon */}
            <button
              className="story-card-expand-btn"
              aria-label={expanded ? 'Collapse' : 'Expand'}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded();
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className={`story-card-expand-icon ${expanded ? 'story-card-expand-icon--expanded' : ''}`}
              >
                <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Expanded Body */}
        {expanded && (
          <div className="story-card-body">
            {/* Status Badge */}
            <div className="story-card-meta">
              <span className={`story-card-status ${getStatusClass(story.status)}`}>
                {story.status || 'draft'}
              </span>
              {story.format && (
                <span className="story-card-format">
                  {story.format === 'job_story' ? 'Job Story' : 'Classic'}
                </span>
              )}
            </div>

            {/* Description */}
            <div className="story-card-section">
              <h4 className="story-card-section-title">Description</h4>
              <p className="story-card-description">{story.description}</p>
            </div>

            {/* Acceptance Criteria */}
            {story.acceptance_criteria && story.acceptance_criteria.length > 0 && (
              <div className="story-card-section">
                <h4 className="story-card-section-title">
                  Acceptance Criteria ({story.acceptance_criteria.length})
                </h4>
                <ul className="story-card-criteria">
                  {story.acceptance_criteria.map((criterion, index) => (
                    <li key={index} className="story-card-criterion">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M13.5 4.5L6 12L2.5 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span>{criterion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* All Labels (in expanded view) */}
            {story.labels && story.labels.length > 0 && (
              <div className="story-card-section">
                <h4 className="story-card-section-title">Labels</h4>
                <div className="story-card-all-labels">
                  {story.labels.map((label, index) => (
                    <span key={index} className="story-card-label story-card-label--expanded">
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="story-card-actions">
              <button
                className="story-card-action-btn story-card-action-btn--edit"
                onClick={handleEditClick}
                type="button"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M11.333 2.00004C11.5081 1.82494 11.7169 1.68605 11.9465 1.59129C12.1761 1.49653 12.4218 1.44775 12.67 1.44775C12.9182 1.44775 13.1639 1.49653 13.3935 1.59129C13.6231 1.68605 13.8319 1.82494 14.007 2.00004C14.1821 2.17513 14.321 2.38394 14.4157 2.61352C14.5105 2.84311 14.5593 3.08882 14.5593 3.33704C14.5593 3.58525 14.5105 3.83096 14.4157 4.06055C14.321 4.29013 14.1821 4.49894 14.007 4.67404L5.00033 13.6807L1.33366 14.6667L2.31966 11.0007L11.333 2.00004Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Edit
              </button>
              <button
                className="story-card-action-btn story-card-action-btn--delete"
                onClick={handleDeleteClick}
                type="button"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2 4H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12.6667 4V13.3333C12.6667 14 12 14.6667 11.3333 14.6667H4.66667C4 14.6667 3.33333 14 3.33333 13.3333V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M5.33333 4V2.66667C5.33333 2 6 1.33334 6.66667 1.33334H9.33333C10 1.33334 10.6667 2 10.6667 2.66667V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M6.66667 7.33334V11.3333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M9.33333 7.33334V11.3333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Delete
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <Modal onClose={() => setShowDeleteConfirm(false)} title="Delete Story">
          <div className="story-card-delete-modal">
            <p className="story-card-delete-message">
              Are you sure you want to delete <strong>{story.story_id}</strong>?
            </p>
            <p className="story-card-delete-warning">
              This action cannot be undone. The story "{story.title}" will be permanently removed.
            </p>
            <div className="story-card-delete-actions">
              <button
                className="story-card-delete-cancel-btn"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                type="button"
              >
                Cancel
              </button>
              <button
                className="story-card-delete-confirm-btn"
                onClick={handleDelete}
                disabled={isDeleting}
                type="button"
              >
                {isDeleting ? 'Deleting...' : 'Delete Story'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

export default StoryCard;
