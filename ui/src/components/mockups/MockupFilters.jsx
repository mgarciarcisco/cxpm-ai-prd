import './MockupFilters.css';

/**
 * MockupFilters component for filtering mockups.
 * Provides dropdowns for Device, Style, and Status, plus a search input.
 *
 * @param {Object} props
 * @param {Object} props.filters - Current filter values
 * @param {string} props.filters.device - Device filter value ('all' or specific device)
 * @param {string} props.filters.style - Style filter value ('all' or specific style)
 * @param {string} props.filters.status - Status filter value ('all' or specific status)
 * @param {string} props.filters.search - Search query
 * @param {Function} props.onChange - Callback when any filter changes
 * @param {number} props.filteredCount - Number of mockups matching current filters
 * @param {number} props.totalCount - Total number of mockups
 */
export function MockupFilters({
  filters = { device: 'all', style: 'all', status: 'all', search: '' },
  onChange,
  filteredCount,
  totalCount,
}) {
  const deviceOptions = [
    { value: 'all', label: 'All Devices' },
    { value: 'desktop', label: 'Desktop' },
    { value: 'tablet', label: 'Tablet' },
    { value: 'mobile', label: 'Mobile' },
  ];

  const styleOptions = [
    { value: 'all', label: 'All Styles' },
    { value: 'modern', label: 'Modern' },
    { value: 'minimal', label: 'Minimal' },
    { value: 'playful', label: 'Playful' },
  ];

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'draft', label: 'Draft' },
    { value: 'ready', label: 'Ready' },
    { value: 'exported', label: 'Exported' },
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
      onChange({ device: 'all', style: 'all', status: 'all', search: '' });
    }
  };

  const hasActiveFilters =
    filters.device !== 'all' ||
    filters.style !== 'all' ||
    filters.status !== 'all' ||
    filters.search !== '';

  const showCount = filteredCount !== totalCount;

  return (
    <div className="mockup-filters">
      <div className="mockup-filters__controls">
        {/* Search Input */}
        <div className="mockup-filters__search">
          <svg
            className="mockup-filters__search-icon"
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
            className="mockup-filters__search-input"
            placeholder="Search mockups..."
            value={filters.search}
            onChange={handleSearchChange}
            aria-label="Search mockups"
          />
          {filters.search && (
            <button
              type="button"
              className="mockup-filters__search-clear"
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

        {/* Device Filter */}
        <div className="mockup-filters__select-wrapper">
          <select
            className="mockup-filters__select"
            value={filters.device}
            onChange={(e) => handleFilterChange('device', e.target.value)}
            aria-label="Filter by device"
          >
            {deviceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Style Filter */}
        <div className="mockup-filters__select-wrapper">
          <select
            className="mockup-filters__select"
            value={filters.style}
            onChange={(e) => handleFilterChange('style', e.target.value)}
            aria-label="Filter by style"
          >
            {styleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="mockup-filters__select-wrapper">
          <select
            className="mockup-filters__select"
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            aria-label="Filter by status"
          >
            {statusOptions.map((option) => (
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
            className="mockup-filters__clear-btn"
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
        <div className="mockup-filters__count">
          Showing {filteredCount} of {totalCount}{' '}
          {totalCount === 1 ? 'mockup' : 'mockups'}
        </div>
      )}
    </div>
  );
}

export default MockupFilters;
