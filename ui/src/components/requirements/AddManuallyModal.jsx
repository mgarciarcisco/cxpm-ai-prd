import React, { useState, useRef, useEffect } from 'react';
import Modal from '../common/Modal';
import './AddManuallyModal.css';

// Section options matching backend API
const SECTIONS = [
  { value: 'problems', label: 'Problems' },
  { value: 'user_goals', label: 'User Goals' },
  { value: 'functional_requirements', label: 'Functional Requirements' },
  { value: 'data_needs', label: 'Data Needs' },
  { value: 'constraints', label: 'Constraints' },
  { value: 'non_goals', label: 'Non Goals' },
  { value: 'risks_assumptions', label: 'Risks & Assumptions' },
  { value: 'open_questions', label: 'Open Questions' },
  { value: 'action_items', label: 'Action Items' },
];

/**
 * Modal for manually adding a requirement to a project.
 * Allows selecting a section and entering content.
 * Supports adding multiple items without closing.
 *
 * @param {object} props
 * @param {string} props.projectId - Project ID for API call
 * @param {string} [props.defaultSection] - Optional pre-selected section key
 * @param {function} props.onClose - Callback to close modal
 * @param {function} [props.onAdd] - Callback when a requirement is added (receives the added requirement)
 */
function AddManuallyModal({ projectId, defaultSection, onClose, onAdd }) {
  const initialSection = defaultSection && SECTIONS.some(s => s.value === defaultSection)
    ? defaultSection
    : SECTIONS[0].value;
  const [section, setSection] = useState(initialSection);
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const contentInputRef = useRef(null);

  const hasContent = content.trim().length > 0;

  // Focus content input on mount and after adding
  useEffect(() => {
    contentInputRef.current?.focus();
  }, []);

  // Clear success message after delay
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleSubmit = async (closeAfter = false) => {
    if (!hasContent || !projectId) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:8000');
      const response = await fetch(`${BASE_URL}/api/projects/${projectId}/requirements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          section,
          content: content.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Failed to add requirement (${response.status})`);
      }

      const addedRequirement = await response.json();

      // Notify parent
      if (onAdd) {
        onAdd(addedRequirement);
      }

      if (closeAfter) {
        onClose();
      } else {
        // Clear content for next entry but keep section
        setContent('');
        setSuccessMessage(`Added to ${SECTIONS.find(s => s.value === section)?.label || section}`);
        // Focus content input for next entry
        contentInputRef.current?.focus();
      }
    } catch (err) {
      setError(err.message || 'Failed to add requirement. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    // Enter key submits (keeps modal open)
    // Ctrl+Enter or Cmd+Enter submits and closes
    if (e.key === 'Enter' && !e.shiftKey) {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        handleSubmit(true);
      } else if (e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        handleSubmit(false);
      }
    }
  };

  return (
    <Modal title="Add Requirement" onClose={onClose}>
      <div className="add-manually-modal" onKeyDown={handleKeyDown}>
        <p className="add-manually-modal__description">
          Add a new requirement to your project. Select the appropriate section and enter the content.
        </p>

        {/* Section dropdown */}
        <div className="add-manually-modal__field">
          <label htmlFor="requirement-section" className="add-manually-modal__label">
            Section
          </label>
          <select
            id="requirement-section"
            className="add-manually-modal__select"
            value={section}
            onChange={(e) => setSection(e.target.value)}
            disabled={isSubmitting}
          >
            {SECTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* Content input */}
        <div className="add-manually-modal__field">
          <label htmlFor="requirement-content" className="add-manually-modal__label">
            Content
          </label>
          <textarea
            id="requirement-content"
            ref={contentInputRef}
            className="add-manually-modal__textarea"
            placeholder="Enter the requirement text..."
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              if (error) setError(null);
            }}
            rows={4}
            disabled={isSubmitting}
          />
        </div>

        {/* Success message */}
        {successMessage && (
          <div className="add-manually-modal__success" role="status">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{successMessage}</span>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="add-manually-modal__error" role="alert">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="add-manually-modal__actions">
          <button
            type="button"
            className="add-manually-modal__cancel-btn"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="add-manually-modal__add-btn"
            onClick={() => handleSubmit(false)}
            disabled={!hasContent || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="add-manually-modal__spinner" aria-hidden="true" />
                Adding...
              </>
            ) : (
              'Add'
            )}
          </button>
          <button
            type="button"
            className="add-manually-modal__add-close-btn"
            onClick={() => handleSubmit(true)}
            disabled={!hasContent || isSubmitting}
          >
            {isSubmitting ? 'Adding...' : 'Add & Close'}
          </button>
        </div>

        <p className="add-manually-modal__hint">
          Press Enter to add another, or Ctrl+Enter to add and close.
        </p>
      </div>
    </Modal>
  );
}

export default AddManuallyModal;
