import React, { useRef, useEffect } from 'react';
import './RequirementItem.css';

/**
 * RequirementItem component - A single requirement item with selection,
 * source tag with tooltip, and edit/delete actions.
 *
 * @param {Object} props
 * @param {Object} props.item - Requirement item object
 * @param {string} props.item.id - Unique identifier
 * @param {string} props.item.content - Requirement text content
 * @param {boolean} props.item.selected - Whether the item is selected
 * @param {string} [props.item.sourceId] - ID of the source meeting
 * @param {string} [props.item.sourceName] - Name of the source meeting
 * @param {string} [props.item.sourceQuote] - Original quote from the meeting
 * @param {Function} props.onToggle - Callback when checkbox is toggled
 * @param {Function} props.onEdit - Callback to start editing
 * @param {Function} props.onDelete - Callback to delete the item
 * @param {boolean} props.isEditing - Whether the item is in edit mode
 * @param {string} props.editValue - Current edit value
 * @param {Function} props.onEditChange - Callback when edit value changes
 * @param {Function} props.onSaveEdit - Callback to save edit
 * @param {Function} props.onCancelEdit - Callback to cancel edit
 */
function RequirementItem({
  item,
  onToggle,
  onEdit,
  onDelete,
  isEditing,
  editValue,
  onEditChange,
  onSaveEdit,
  onCancelEdit,
}) {
  const textareaRef = useRef(null);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // Move cursor to end
      const length = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(length, length);
    }
  }, [isEditing]);

  // Handle keyboard events in edit mode
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancelEdit();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onSaveEdit();
    }
  };

  const itemClasses = [
    'requirement-item',
    !item.selected && 'requirement-item--deselected',
    isEditing && 'requirement-item--editing',
  ].filter(Boolean).join(' ');

  return (
    <div className={itemClasses}>
      {isEditing ? (
        <div className="requirement-item__edit-container">
          <textarea
            ref={textareaRef}
            className="requirement-item__edit-textarea"
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
            aria-label="Edit requirement"
          />
          <div className="requirement-item__edit-actions">
            <button
              type="button"
              className="requirement-item__save-btn"
              onClick={onSaveEdit}
            >
              Save
            </button>
            <button
              type="button"
              className="requirement-item__cancel-btn"
              onClick={onCancelEdit}
            >
              Cancel
            </button>
            <span className="requirement-item__edit-hint">
              Ctrl+Enter to save, Esc to cancel
            </span>
          </div>
        </div>
      ) : (
        <>
          <input
            type="checkbox"
            className="requirement-item__checkbox"
            checked={item.selected}
            onChange={onToggle}
            aria-label={`Select: ${item.content.substring(0, 50)}`}
          />
          <div className="requirement-item__content">
            <div className="requirement-item__text">{item.content}</div>
            {item.sourceName && (
              <div className="requirement-item__source">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
                <span className="requirement-item__source-name">{item.sourceName}</span>
                {item.sourceQuote && (
                  <div className="requirement-item__tooltip">
                    <span className="requirement-item__tooltip-label">Source:</span>
                    {item.sourceQuote}
                    <div className="requirement-item__tooltip-arrow" />
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="requirement-item__actions">
            <button
              type="button"
              className="requirement-item__action-btn"
              onClick={onEdit}
              title="Edit"
              aria-label={`Edit: ${item.content.substring(0, 50)}`}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button
              type="button"
              className="requirement-item__action-btn requirement-item__action-btn--delete"
              onClick={onDelete}
              title="Delete"
              aria-label={`Delete: ${item.content.substring(0, 50)}`}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default RequirementItem;
