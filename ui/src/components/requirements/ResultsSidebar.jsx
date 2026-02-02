import React from 'react';
import PropTypes from 'prop-types';
import './ResultsSidebar.css';

/**
 * ResultsSidebar component - sidebar for filtering and actions on extracted requirements
 *
 * Props:
 * - categories: array of { key, label, icon, count } - all available categories with counts
 * - activeCategory: string - currently selected category key ('all' or specific)
 * - onCategoryChange: (key) => void
 * - sources: array of { id, name, checked } - meeting sources
 * - onSourceToggle: (id) => void
 * - selectedCount: number
 * - totalCount: number
 * - nextAction: string - current dropdown value
 * - onNextActionChange: (value) => void
 * - onContinue: () => void
 * - onStartOver: () => void
 */
function ResultsSidebar({
  categories = [],
  activeCategory = 'all',
  onCategoryChange,
  sources = [],
  onSourceToggle,
  selectedCount = 0,
  totalCount = 0,
  nextAction = 'save',
  onNextActionChange,
  onContinue,
  onStartOver,
}) {
  const handleCategoryClick = (key) => {
    if (onCategoryChange) {
      onCategoryChange(key);
    }
  };

  const handleSourceToggle = (id) => {
    if (onSourceToggle) {
      onSourceToggle(id);
    }
  };

  const handleActionChange = (e) => {
    if (onNextActionChange) {
      onNextActionChange(e.target.value);
    }
  };

  const handleContinue = () => {
    if (onContinue) {
      onContinue();
    }
  };

  const handleStartOver = (e) => {
    e.preventDefault();
    if (onStartOver) {
      onStartOver();
    }
  };

  return (
    <aside className="results-sidebar">
      {/* Next Action Section */}
      <div className="results-sidebar__section">
        <div className="results-sidebar__label">Next Action</div>
        <select
          className="results-sidebar__dropdown"
          value={nextAction}
          onChange={handleActionChange}
        >
          <option value="save">Save to Project</option>
          <option value="prd" disabled>
            Generate PRD (Coming Soon)
          </option>
          <option value="stories">Generate User Stories</option>
        </select>
        <button
          className="results-sidebar__continue-btn"
          onClick={handleContinue}
          disabled={selectedCount === 0}
        >
          Continue
        </button>
        <a href="#" className="results-sidebar__start-over" onClick={handleStartOver}>
          Start Over
        </a>
      </div>

      {/* Categories Section */}
      <div className="results-sidebar__section">
        <div className="results-sidebar__label">Categories</div>
        <ul className="results-sidebar__category-list">
          {categories.map((category) => (
            <li
              key={category.key}
              className={`results-sidebar__category-item ${
                activeCategory === category.key
                  ? 'results-sidebar__category-item--active'
                  : ''
              }`}
              onClick={() => handleCategoryClick(category.key)}
            >
              <span className="results-sidebar__category-icon">{category.icon}</span>
              <span className="results-sidebar__category-name">{category.label}</span>
              <span className="results-sidebar__category-count">{category.count}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Sources Section */}
      {sources.length > 0 && (
        <div className="results-sidebar__section">
          <div className="results-sidebar__label">Sources</div>
          <ul className="results-sidebar__source-list">
            {sources.map((source) => (
              <li key={source.id} className="results-sidebar__source-item">
                <input
                  type="checkbox"
                  id={`source-${source.id}`}
                  checked={source.checked}
                  onChange={() => handleSourceToggle(source.id)}
                />
                <label htmlFor={`source-${source.id}`}>{source.name}</label>
              </li>
            ))}
          </ul>
          <div className="results-sidebar__summary">
            <span>
              <strong>{selectedCount}</strong> of {totalCount} selected
            </span>
          </div>
        </div>
      )}

      {/* Sources summary when no sources but we have counts */}
      {sources.length === 0 && totalCount > 0 && (
        <div className="results-sidebar__section">
          <div className="results-sidebar__label">Selection</div>
          <div className="results-sidebar__summary results-sidebar__summary--no-border">
            <span>
              <strong>{selectedCount}</strong> of {totalCount} selected
            </span>
          </div>
        </div>
      )}
    </aside>
  );
}

ResultsSidebar.propTypes = {
  categories: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      icon: PropTypes.node,
      count: PropTypes.number.isRequired,
    })
  ),
  activeCategory: PropTypes.string,
  onCategoryChange: PropTypes.func,
  sources: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      name: PropTypes.string.isRequired,
      checked: PropTypes.bool.isRequired,
    })
  ),
  onSourceToggle: PropTypes.func,
  selectedCount: PropTypes.number,
  totalCount: PropTypes.number,
  nextAction: PropTypes.string,
  onNextActionChange: PropTypes.func,
  onContinue: PropTypes.func,
  onStartOver: PropTypes.func,
};

export default ResultsSidebar;
