import './StoryFilters.css';

/**
 * StoryFilters component for filtering user stories.
 * Provides dropdowns for Size and Priority, plus a search input.
 *
 * @param {Object} props
 * @param {Object} props.filters - Current filter values
 * @param {string} props.filters.size - Size filter value ('all' or specific size)
 * @param {string} props.filters.priority - Priority filter value ('all' or specific priority)
 * @param {string} props.filters.search - Search query
 * @param {Function} props.onChange - Callback when any filter changes
 * @param {number} props.filteredCount - Number of stories matching current filters
 * @param {number} props.totalCount - Total number of stories
 */
export function StoryFilters({
  filters = { size: 'all', priority: 'all', search: '' },
  onChange,
  filteredCount,
  totalCount,
}) {
  const sizeOptions = [
    { value: 'all', label: 'All Sizes' },
    { value: 'XS', label: 'XS' },
    { value: 'S', label: 'S' },
    { value: 'M', label: 'M' },
    { value: 'L', label: 'L' },
    { value: 'XL', label: 'XL' },
  ];

  const priorityOptions = [
    { value: 'all', label: 'All Priorities' },
    { value: 'critical', label: 'Critical' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
  ];

  const handleFilterChange = (key, value) => {
    if (onChange) {
      onChange({ ...filters, [key]: value });
    }
  };

  const handleSearchChange = (e) => {
    handleFilterChange('search', e.target.value);
  };

  const handleClearFilters = () => {
    if (onChange) {
      onChange({ size: 'all', priority: 'all', search: '' });
    }
  };

  const hasActiveFilters =
    filters.size !== 'all' ||
    filters.priority !== 'all' ||
    filters.search !== '';

  const showCount = filteredCount !== totalCount;

  return (
    <div className="story-filters">
      <div className="story-filters__controls">
        {/* Search Input */}
        <div className="story-filters__search">
          <svg
            className="story-filters__search-icon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            className="story-filters__search-input"
            placeholder="Search stories..."
            value={filters.search}
            onChange={handleSearchChange}
            aria-label="Search stories"
          />
          {filters.search && (
            <button
              type="button"
              className="story-filters__search-clear"
              onClick={() => handleFilterChange('search', '')}
              aria-label="Clear search"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Size Filter */}
        <div className="story-filters__select-wrapper">
          <select
            className="story-filters__select"
            value={filters.size}
            onChange={(e) => handleFilterChange('size', e.target.value)}
            aria-label="Filter by size"
          >
            {sizeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Priority Filter */}
        <div className="story-filters__select-wrapper">
          <select
            className="story-filters__select"
            value={filters.priority}
            onChange={(e) => handleFilterChange('priority', e.target.value)}
            aria-label="Filter by priority"
          >
            {priorityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <button
            type="button"
            className="story-filters__clear-btn"
            onClick={handleClearFilters}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Clear Filters
          </button>
        )}
      </div>

      {/* Filtered Count */}
      {showCount && (
        <div className="story-filters__count">
          Showing {filteredCount} of {totalCount}{' '}
          {totalCount === 1 ? 'story' : 'stories'}
        </div>
      )}
    </div>
  );
}

export default StoryFilters;
