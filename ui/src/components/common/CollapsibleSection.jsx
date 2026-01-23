import { useState } from 'react';
import './CollapsibleSection.css';

export function CollapsibleSection({ title, itemCount, children, defaultExpanded = true }) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const handleToggle = () => {
    setIsExpanded((prev) => !prev);
  };

  return (
    <div className="collapsible-section">
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
          <span className="collapsible-section-count">{itemCount}</span>
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
