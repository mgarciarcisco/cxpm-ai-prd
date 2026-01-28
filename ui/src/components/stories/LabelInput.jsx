import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import './LabelInput.css';

/**
 * LabelInput component for managing labels with inline editing and autocomplete.
 *
 * @param {Array<string>} labels - Current labels for this story
 * @param {Array<string>} allLabels - All labels used across all stories (for autocomplete)
 * @param {function} onAdd - Callback when a label is added, receives (labelText)
 * @param {function} onRemove - Callback when a label is removed, receives (labelText)
 * @param {boolean} disabled - Whether the input is disabled
 * @param {string} size - Size variant: 'small' (compact, for card header) or 'default' (expanded view)
 */
export function LabelInput({
  labels = [],
  allLabels = [],
  onAdd,
  onRemove,
  disabled = false,
  size = 'default',
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // Filter suggestions based on input (exclude already-added labels)
  const suggestions = useMemo(() => {
    if (!inputValue.trim()) return [];
    const search = inputValue.toLowerCase().trim();
    return allLabels
      .filter(
        (label) =>
          label.toLowerCase().includes(search) &&
          !labels.some((l) => l.toLowerCase() === label.toLowerCase())
      )
      .slice(0, 5); // Limit to 5 suggestions
  }, [inputValue, allLabels, labels]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  // Close editing when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsEditing(false);
        setInputValue('');
        setShowSuggestions(false);
      }
    };

    if (isEditing) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isEditing]);

  // Reset selected suggestion when suggestions change
  useEffect(() => {
    setSelectedSuggestionIndex(0);
  }, [suggestions]);

  const handleAddLabel = useCallback(
    (labelText) => {
      const trimmed = labelText.trim();
      if (!trimmed) return;

      // Check if label already exists (case-insensitive)
      if (labels.some((l) => l.toLowerCase() === trimmed.toLowerCase())) {
        setInputValue('');
        setShowSuggestions(false);
        return;
      }

      if (onAdd) {
        onAdd(trimmed);
      }
      setInputValue('');
      setShowSuggestions(false);
      // Keep input focused for adding more labels
      if (inputRef.current) {
        inputRef.current.focus();
      }
    },
    [labels, onAdd]
  );

  const handleRemoveLabel = useCallback(
    (e, labelText) => {
      e.stopPropagation();
      if (onRemove) {
        onRemove(labelText);
      }
    },
    [onRemove]
  );

  const handleInputChange = useCallback((e) => {
    setInputValue(e.target.value);
    setShowSuggestions(true);
  }, []);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (showSuggestions && suggestions.length > 0) {
          // Select highlighted suggestion
          handleAddLabel(suggestions[selectedSuggestionIndex]);
        } else if (inputValue.trim()) {
          // Add typed label
          handleAddLabel(inputValue);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setIsEditing(false);
        setInputValue('');
        setShowSuggestions(false);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (suggestions.length > 0) {
          setSelectedSuggestionIndex((prev) =>
            prev < suggestions.length - 1 ? prev + 1 : prev
          );
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (suggestions.length > 0) {
          setSelectedSuggestionIndex((prev) => (prev > 0 ? prev - 1 : 0));
        }
      } else if (e.key === 'Backspace' && !inputValue && labels.length > 0) {
        // Remove last label when backspace on empty input
        if (onRemove) {
          onRemove(labels[labels.length - 1]);
        }
      }
    },
    [
      inputValue,
      showSuggestions,
      suggestions,
      selectedSuggestionIndex,
      labels,
      handleAddLabel,
      onRemove,
    ]
  );

  const handleSuggestionClick = useCallback(
    (suggestion) => {
      handleAddLabel(suggestion);
    },
    [handleAddLabel]
  );

  const handleStartEditing = useCallback(
    (e) => {
      e.stopPropagation();
      if (!disabled) {
        setIsEditing(true);
      }
    },
    [disabled]
  );

  const sizeClass = size === 'small' ? 'label-input--small' : '';

  return (
    <div
      className={`label-input ${sizeClass} ${isEditing ? 'label-input--editing' : ''}`}
      ref={containerRef}
      onClick={handleStartEditing}
    >
      {/* Existing labels */}
      <div className="label-input__labels">
        {labels.map((label) => (
          <span key={label} className="label-input__chip">
            <span className="label-input__chip-text">{label}</span>
            {!disabled && (
              <button
                type="button"
                className="label-input__chip-remove"
                onClick={(e) => handleRemoveLabel(e, label)}
                aria-label={`Remove label ${label}`}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </span>
        ))}

        {/* Add label button/input */}
        {isEditing ? (
          <div className="label-input__input-wrapper">
            <input
              ref={inputRef}
              type="text"
              className="label-input__input"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type to add label..."
              disabled={disabled}
              autoComplete="off"
            />

            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="label-input__suggestions">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={suggestion}
                    type="button"
                    className={`label-input__suggestion ${
                      index === selectedSuggestionIndex
                        ? 'label-input__suggestion--selected'
                        : ''
                    }`}
                    onClick={() => handleSuggestionClick(suggestion)}
                    onMouseEnter={() => setSelectedSuggestionIndex(index)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          !disabled && (
            <button
              type="button"
              className="label-input__add-btn"
              onClick={handleStartEditing}
              aria-label="Add label"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span className="label-input__add-text">Add</span>
            </button>
          )
        )}
      </div>
    </div>
  );
}

export default LabelInput;
