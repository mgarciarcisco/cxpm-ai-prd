import { useState } from 'react';
import './CollapsibleSection.css';

/**
 * Get the CSS class modifier for the badge variant
 * @param {string} variant - The section variant (e.g., 'problems', 'user_goals')
 * @param {number} itemCount - The number of items in the section
 * @returns {string} The CSS modifier class
 */
function getBadgeVariantClass(variant, itemCount) {
  if (itemCount === 0) {
    return 'collapsible-section-count--empty';
  }

  const variantMap = {
    needs_and_goals: 'collapsible-section-count--needs-and-goals',
    requirements: 'collapsible-section-count--requirements',
    scope_and_constraints: 'collapsible-section-count--scope-and-constraints',
    risks_and_questions: 'collapsible-section-count--risks-and-questions',
    action_items: 'collapsible-section-count--action-items',
  };

  return variantMap[variant] || '';
}

export function CollapsibleSection({
  title,
  itemCount,
  children,
  defaultExpanded = true,
  variant = '',
  id = ''
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const handleToggle = () => {
    setIsExpanded((prev) => !prev);
  };

  const isEmpty = typeof itemCount === 'number' && itemCount === 0;
  const sectionClassName = `collapsible-section${isEmpty ? ' collapsible-section--empty' : ''}`;
  const badgeClassName = `collapsible-section-count ${getBadgeVariantClass(variant, itemCount)}`.trim();

  return (
    <div className={sectionClassName} id={id || undefined}>
      <button
        className="collapsible-section-header"
        onClick={handleToggle}
        aria-expanded={isExpanded}
        type="button"
      >
        <span className="collapsible-section-icon">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={`collapsible-section-chevron ${isExpanded ? 'collapsible-section-chevron--expanded' : ''}`}
          >
            <path
              d="M6 12L10 8L6 4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="collapsible-section-title">{title}</span>
        {typeof itemCount === 'number' && (
          <span className={badgeClassName}>{itemCount}</span>
        )}
      </button>
      {isExpanded && (
        <div className="collapsible-section-content">
          {children}
        </div>
      )}
    </div>
  );
}

export default CollapsibleSection;
