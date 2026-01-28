import { useState, useEffect, useRef, useCallback } from 'react';
import './ProjectSearch.css';

/**
 * Search input component with debouncing for filtering projects by name.
 * @param {Object} props
 * @param {string} props.value - Current search value
 * @param {Function} props.onChange - Callback when search value changes (debounced)
 * @param {number} props.debounceMs - Debounce delay in milliseconds (default: 300)
 * @param {string} props.placeholder - Placeholder text (default: "Search projects...")
 */
export function ProjectSearch({
  value = '',
  onChange,
  debounceMs = 300,
  placeholder = 'Search projects...',
}) {
  const [inputValue, setInputValue] = useState(value);
  const debounceTimer = useRef(null);

  // Sync input with external value changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  const handleInputChange = useCallback(
    (e) => {
      const newValue = e.target.value;
      setInputValue(newValue);

      // Clear existing timer
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      // Set new debounced timer
      debounceTimer.current = setTimeout(() => {
        if (onChange) {
          onChange(newValue);
        }
      }, debounceMs);
    },
    [onChange, debounceMs]
  );

  const handleClear = useCallback(() => {
    setInputValue('');
    // Clear any pending debounce and immediately call onChange
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    if (onChange) {
      onChange('');
    }
  }, [onChange]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        handleClear();
        e.target.blur();
      }
    },
    [handleClear]
  );

  return (
    <div className="project-search">
      <div className="project-search__input-wrapper">
        <svg
          className="project-search__icon"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
          <path
            d="M21 21L16.65 16.65"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <input
          type="text"
          className="project-search__input"
          placeholder={placeholder}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          aria-label="Search projects"
        />
        {inputValue && (
          <button
            type="button"
            className="project-search__clear"
            onClick={handleClear}
            aria-label="Clear search"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M6 6L18 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export default ProjectSearch;
