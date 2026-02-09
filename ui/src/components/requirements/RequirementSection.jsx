import React, { useState, useRef, useEffect } from 'react';
import './RequirementSection.css';

/**
 * Section labels mapping from backend section values to human-readable labels.
 * Matches the order from the backend API.
 */
export const SECTION_LABELS = {
  needs_and_goals: 'Needs & Goals',
  requirements: 'Requirements',
  scope_and_constraints: 'Scope & Constraints',
  risks_and_questions: 'Risks & Open Questions',
  action_items: 'Action Items',
};

/**
 * Ordered list of section keys for consistent display order.
 */
export const SECTION_ORDER = [
  'needs_and_goals',
  'requirements',
  'scope_and_constraints',
  'risks_and_questions',
  'action_items',
];

/**
 * RequirementSection component - A collapsible section displaying requirements
 * with edit/delete actions on hover and an add button.
 *
 * @param {Object} props
 * @param {string} props.section - Section key (e.g., 'problems', 'user_goals')
 * @param {Array} props.items - Array of requirement objects
 * @param {Function} props.onAdd - Callback to add a new item to this section
 * @param {Function} props.onSave - Callback when saving an edited item (receives item id and new content)
 * @param {Function} props.onDelete - Callback when deleting an item (receives item id)
 * @param {boolean} [props.defaultExpanded=true] - Whether section is initially expanded
 */
function RequirementSection({
  section,
  items = [],
  onAdd,
  onSave,
  onDelete,
  defaultExpanded = true,
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef(null);

  const sectionLabel = SECTION_LABELS[section] || section;
  const itemCount = items.length;

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
  };

  const handleAddClick = (e) => {
    e.stopPropagation();
    if (onAdd) {
      onAdd(section);
    }
  };

  // Focus input when entering edit mode
  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      // Move cursor to end of input
      inputRef.current.setSelectionRange(editValue.length, editValue.length);
    }
  }, [editingId, editValue.length]);

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
    const originalItem = items.find(i => i.id === editingId);

    // Don't save if empty or unchanged
    if (!trimmedValue || (originalItem && trimmedValue === originalItem.content)) {
      handleCancelEdit();
      return;
    }

    setIsSaving(true);

    try {
      if (onSave) {
        await onSave(editingId, trimmedValue);
      }
      handleCancelEdit();
    } catch (error) {
      // Keep edit mode open on error so user can retry
      setIsSaving(false);
      console.error('Failed to save requirement:', error);
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

  return (
    <div className={`requirement-section ${isExpanded ? 'requirement-section--expanded' : ''}`}>
      {/* Section Header */}
      <button
        className="requirement-section__header"
        onClick={handleToggle}
        aria-expanded={isExpanded}
        aria-controls={`section-${section}-content`}
      >
        <div className="requirement-section__header-left">
          <span className="requirement-section__chevron" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M6 4L10 8L6 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="requirement-section__title">{sectionLabel}</span>
          <span className="requirement-section__count">({itemCount})</span>
        </div>
        <button
          className="requirement-section__add-btn"
          onClick={handleAddClick}
          title={`Add item to ${sectionLabel}`}
          aria-label={`Add item to ${sectionLabel}`}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 3V13M3 8H13"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>Add</span>
        </button>
      </button>

      {/* Section Content */}
      {isExpanded && (
        <ul
          id={`section-${section}-content`}
          className="requirement-section__list"
          role="list"
        >
          {items.length === 0 ? (
            <li className="requirement-section__empty">
              No items in this section
            </li>
          ) : (
            items.map((item) => {
              const isEditing = editingId === item.id;
              return (
                <li
                  key={item.id}
                  className={`requirement-section__item ${isEditing ? 'requirement-section__item--editing' : ''}`}
                >
                  <span className="requirement-section__bullet" aria-hidden="true">•</span>
                  {isEditing ? (
                    <input
                      ref={inputRef}
                      type="text"
                      className="requirement-section__edit-input"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={handleEditKeyDown}
                      onBlur={handleSaveEdit}
                      disabled={isSaving}
                      aria-label="Edit requirement"
                    />
                  ) : (
                    <span className="requirement-section__content">{item.content}</span>
                  )}
                  {isEditing ? (
                    <div className="requirement-section__edit-actions">
                      {isSaving && (
                        <span className="requirement-section__saving" aria-label="Saving">
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.25"/>
                            <path d="M7 1a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                        </span>
                      )}
                      <span className="requirement-section__edit-hint">
                        Enter to save, Esc to cancel
                      </span>
                    </div>
                  ) : (
                    <div className="requirement-section__actions">
                      <button
                        className="requirement-section__action-btn"
                        onClick={() => handleStartEdit(item)}
                        title="Edit"
                        aria-label={`Edit: ${item.content.substring(0, 50)}`}
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path
                            d="M10.5 1.75L12.25 3.5M1.75 12.25L2.625 9.1875L9.625 2.1875L11.8125 4.375L4.8125 11.375L1.75 12.25Z"
                            stroke="currentColor"
                            strokeWidth="1.25"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                      <button
                        className="requirement-section__action-btn requirement-section__action-btn--delete"
                        onClick={() => onDelete && onDelete(item.id)}
                        title="Delete"
                        aria-label={`Delete: ${item.content.substring(0, 50)}`}
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path
                            d="M1.75 3.5H12.25M5.25 6.125V10.375M8.75 6.125V10.375M2.625 3.5L3.5 11.375C3.5 11.8391 3.68437 12.2842 4.01256 12.6124C4.34075 12.9406 4.78587 13.125 5.25 13.125H8.75C9.21413 13.125 9.65925 12.9406 9.98744 12.6124C10.3156 12.2842 10.5 11.8391 10.5 11.375L11.375 3.5M4.8125 3.5V1.75C4.8125 1.5181 4.90469 1.29564 5.06909 1.13128C5.2335 0.966911 5.45595 0.875 5.6875 0.875H8.3125C8.54405 0.875 8.7665 0.966911 8.93091 1.13128C9.09531 1.29564 9.1875 1.5181 9.1875 1.75V3.5"
                            stroke="currentColor"
                            strokeWidth="1.25"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </div>
                  )}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}

export default RequirementSection;
