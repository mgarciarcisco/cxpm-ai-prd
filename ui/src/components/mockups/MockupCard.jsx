import { useState, useRef, useEffect } from 'react';
import './MockupCard.css';

/**
 * MockupCard component displays a single mockup with thumbnail and details.
 *
 * @param {Object} mockup - The mockup data
 * @param {string} mockup.id - UUID of the mockup
 * @param {string} mockup.mockup_id - Formatted mockup ID (e.g., "MK-001")
 * @param {string} mockup.title - Mockup title
 * @param {string} mockup.description - Mockup description
 * @param {string} mockup.device - Target device (desktop, tablet, mobile)
 * @param {string} mockup.style - Visual style (modern, minimal, playful)
 * @param {string} mockup.thumbnail_url - URL to mockup thumbnail image
 * @param {string} mockup.status - Mockup status (draft, ready, exported)
 * @param {string} mockup.created_at - Creation timestamp
 * @param {function} onView - Callback when view button is clicked
 * @param {function} onDelete - Callback when mockup is deleted
 * @param {function} onRename - Callback when mockup is renamed, receives (id, newTitle)
 */
export function MockupCard({
  mockup,
  onView,
  onDelete,
  onRename,
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(mockup.title);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef(null);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Update editTitle if mockup.title changes externally
  useEffect(() => {
    if (!isEditing) {
      setEditTitle(mockup.title);
    }
  }, [mockup.title, isEditing]);

  const handleEditClick = (e) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditTitle(mockup.title);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditTitle(mockup.title);
  };

  const handleSaveEdit = async () => {
    const trimmedTitle = editTitle.trim();

    // Don't save if empty or unchanged
    if (!trimmedTitle || trimmedTitle === mockup.title) {
      handleCancelEdit();
      return;
    }

    if (!onRename) {
      setIsEditing(false);
      return;
    }

    try {
      setIsSaving(true);
      await onRename(mockup.id, trimmedTitle);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to rename mockup:', err);
      // Keep edit mode open so user can retry
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  const handleInputChange = (e) => {
    setEditTitle(e.target.value);
  };

  const handleInputBlur = () => {
    // Small delay to allow click handlers to fire first
    setTimeout(() => {
      if (isEditing && !isSaving) {
        handleSaveEdit();
      }
    }, 100);
  };

  const handleDelete = async () => {
    if (!onDelete) return;

    try {
      setIsDeleting(true);
      await onDelete(mockup.id);
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error('Failed to delete mockup:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleViewClick = () => {
    if (onView) {
      onView(mockup);
    }
  };

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  // Device icon mapping
  const getDeviceIcon = (device) => {
    switch (device?.toLowerCase()) {
      case 'mobile':
        return (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="1" width="8" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="8" cy="12.5" r="0.75" fill="currentColor"/>
          </svg>
        );
      case 'tablet':
        return (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="1.5" width="12" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="8" cy="12" r="0.75" fill="currentColor"/>
          </svg>
        );
      case 'desktop':
      default:
        return (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="2" width="14" height="10" rx="1" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M5 14H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M8 12V14" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        );
    }
  };

  // Device badge class
  const getDeviceClass = (device) => {
    switch (device?.toLowerCase()) {
      case 'mobile':
        return 'mockup-card__device--mobile';
      case 'tablet':
        return 'mockup-card__device--tablet';
      case 'desktop':
      default:
        return 'mockup-card__device--desktop';
    }
  };

  // Style badge class
  const getStyleClass = (style) => {
    switch (style?.toLowerCase()) {
      case 'minimal':
        return 'mockup-card__style--minimal';
      case 'playful':
        return 'mockup-card__style--playful';
      case 'modern':
      default:
        return 'mockup-card__style--modern';
    }
  };

  // Status badge class
  const getStatusClass = (status) => {
    switch (status?.toLowerCase()) {
      case 'ready':
        return 'mockup-card__status--ready';
      case 'exported':
        return 'mockup-card__status--exported';
      case 'draft':
      default:
        return 'mockup-card__status--draft';
    }
  };

  // Placeholder image for mockups without thumbnails
  const placeholderSvg = (
    <svg width="100%" height="100%" viewBox="0 0 200 150" fill="none" xmlns="http://www.w3.org/2000/svg" className="mockup-card__placeholder-svg">
      <rect width="200" height="150" fill="#F3F4F6"/>
      <rect x="20" y="20" width="160" height="20" rx="4" fill="#E5E7EB"/>
      <rect x="20" y="50" width="100" height="12" rx="3" fill="#E5E7EB"/>
      <rect x="20" y="70" width="140" height="8" rx="2" fill="#E5E7EB"/>
      <rect x="20" y="85" width="120" height="8" rx="2" fill="#E5E7EB"/>
      <rect x="20" y="110" width="60" height="24" rx="4" fill="#D1D5DB"/>
    </svg>
  );

  return (
    <>
      <div className="mockup-card" onClick={handleViewClick}>
        {/* Thumbnail */}
        <div className="mockup-card__thumbnail">
          {mockup.thumbnail_url ? (
            <img
              src={mockup.thumbnail_url}
              alt={mockup.title}
              className="mockup-card__thumbnail-img"
            />
          ) : (
            <div className="mockup-card__placeholder">
              {placeholderSvg}
            </div>
          )}

          {/* Device badge overlay */}
          <span className={`mockup-card__device ${getDeviceClass(mockup.device)}`}>
            {getDeviceIcon(mockup.device)}
            <span>{mockup.device || 'desktop'}</span>
          </span>
        </div>

        {/* Content */}
        <div className="mockup-card__content">
          {/* Header with ID and status */}
          <div className="mockup-card__header">
            <span className="mockup-card__id">{mockup.mockup_id}</span>
            <span className={`mockup-card__status ${getStatusClass(mockup.status)}`}>
              {mockup.status || 'draft'}
            </span>
          </div>

          {/* Title - inline edit or display */}
          {isEditing ? (
            <div className="mockup-card__title-edit" onClick={(e) => e.stopPropagation()}>
              <input
                ref={inputRef}
                type="text"
                className="mockup-card__title-input"
                value={editTitle}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onBlur={handleInputBlur}
                disabled={isSaving}
                maxLength={100}
              />
              <div className="mockup-card__title-edit-actions">
                <button
                  type="button"
                  className="mockup-card__title-edit-btn mockup-card__title-edit-btn--save"
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  title="Save"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2.5 8.5L6 12L13.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <button
                  type="button"
                  className="mockup-card__title-edit-btn mockup-card__title-edit-btn--cancel"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  title="Cancel"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          ) : (
            <div className="mockup-card__title-row">
              <h3 className="mockup-card__title">{mockup.title}</h3>
              <button
                type="button"
                className="mockup-card__edit-btn"
                onClick={handleEditClick}
                title="Rename mockup"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M11.333 2.00004C11.5081 1.82494 11.7169 1.68605 11.9467 1.59129C12.1765 1.49653 12.4227 1.44775 12.6714 1.44775C12.9201 1.44775 13.1662 1.49653 13.396 1.59129C13.6258 1.68605 13.8346 1.82494 14.0097 2.00004C14.1848 2.17513 14.3237 2.38394 14.4185 2.61374C14.5132 2.84354 14.562 3.08968 14.562 3.33837C14.562 3.58706 14.5132 3.8332 14.4185 4.063C14.3237 4.2928 14.1848 4.50161 14.0097 4.67671L5.00001 13.6864L1.33334 14.6667L2.31368 11.0001L11.333 2.00004Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          )}

          {/* Description preview */}
          {mockup.description && (
            <p className="mockup-card__description">{mockup.description}</p>
          )}

          {/* Footer with style and actions */}
          <div className="mockup-card__footer">
            <span className={`mockup-card__style ${getStyleClass(mockup.style)}`}>
              {mockup.style || 'modern'}
            </span>

            <div className="mockup-card__actions">
              <button
                className="mockup-card__action-btn mockup-card__action-btn--view"
                onClick={handleViewClick}
                type="button"
                title="View mockup"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1.33333 8C1.33333 8 3.33333 3.33334 8 3.33334C12.6667 3.33334 14.6667 8 14.6667 8C14.6667 8 12.6667 12.6667 8 12.6667C3.33333 12.6667 1.33333 8 1.33333 8Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
              </button>
              <button
                className="mockup-card__action-btn mockup-card__action-btn--delete"
                onClick={handleDeleteClick}
                type="button"
                title="Delete mockup"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2 4H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12.6667 4V13.3333C12.6667 14 12 14.6667 11.3333 14.6667H4.66667C4 14.6667 3.33333 14 3.33333 13.3333V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M5.33333 4V2.66667C5.33333 2 6 1.33334 6.66667 1.33334H9.33333C10 1.33334 10.6667 2 10.6667 2.66667V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="mockup-card__modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="mockup-card__modal" onClick={(e) => e.stopPropagation()}>
            <h4 className="mockup-card__modal-title">Delete Mockup</h4>
            <p className="mockup-card__modal-message">
              Are you sure you want to delete <strong>{mockup.mockup_id}</strong>?
            </p>
            <p className="mockup-card__modal-warning">
              This action cannot be undone. The mockup "{mockup.title}" will be permanently removed.
            </p>
            <div className="mockup-card__modal-actions">
              <button
                className="mockup-card__modal-cancel"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                type="button"
              >
                Cancel
              </button>
              <button
                className="mockup-card__modal-confirm"
                onClick={handleDelete}
                disabled={isDeleting}
                type="button"
              >
                {isDeleting ? 'Deleting...' : 'Delete Mockup'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default MockupCard;
