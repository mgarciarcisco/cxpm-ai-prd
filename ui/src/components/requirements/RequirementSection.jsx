import React, { useState } from 'react';
import './RequirementSection.css';

/**
 * Section labels mapping from backend section values to human-readable labels.
 * Matches the order from the backend API.
 */
export const SECTION_LABELS = {
  problems: 'Problems',
  user_goals: 'User Goals',
  functional_requirements: 'Functional Requirements',
  data_needs: 'Data Needs',
  constraints: 'Constraints',
  non_goals: 'Non Goals',
  risks_assumptions: 'Risks & Assumptions',
  open_questions: 'Open Questions',
  action_items: 'Action Items',
};

/**
 * Ordered list of section keys for consistent display order.
 */
export const SECTION_ORDER = [
  'problems',
  'user_goals',
  'functional_requirements',
  'data_needs',
  'constraints',
  'non_goals',
  'risks_assumptions',
  'open_questions',
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
 * @param {Function} props.onEdit - Callback when editing an item (receives item id)
 * @param {Function} props.onDelete - Callback when deleting an item (receives item id)
 * @param {boolean} [props.defaultExpanded=true] - Whether section is initially expanded
 */
function RequirementSection({
  section,
  items = [],
  onAdd,
  onEdit,
  onDelete,
  defaultExpanded = true,
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

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
            items.map((item) => (
              <li key={item.id} className="requirement-section__item">
                <span className="requirement-section__bullet" aria-hidden="true">•</span>
                <span className="requirement-section__content">{item.content}</span>
                <div className="requirement-section__actions">
                  <button
                    className="requirement-section__action-btn"
                    onClick={() => onEdit && onEdit(item.id)}
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
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export default RequirementSection;
