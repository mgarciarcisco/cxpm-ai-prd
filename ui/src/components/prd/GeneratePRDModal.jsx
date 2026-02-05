import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import './GeneratePRDModal.css';

// PRD mode options matching backend API
const PRD_MODES = [
  {
    value: 'draft',
    label: 'Brief',
    description: 'Quick overview with key sections. Best for initial planning.',
  },
  {
    value: 'detailed',
    label: 'Detailed',
    description: 'Comprehensive PRD with full context. Best for documentation.',
  },
];

/**
 * Modal for selecting PRD generation options.
 * Allows choosing between Brief and Detailed modes.
 * Shows requirements count and triggers generation.
 *
 * @param {object} props
 * @param {string} props.projectId - Project ID for API call
 * @param {number} [props.requirementsCount] - Number of requirements (optional, fetched if not provided)
 * @param {function} props.onClose - Callback to close modal
 * @param {function} props.onGenerate - Callback when generation starts (receives mode)
 */
function GeneratePRDModal({ projectId, requirementsCount: propRequirementsCount, onClose, onGenerate }) {
  const [selectedMode, setSelectedMode] = useState('detailed');
  const [requirementsCount, setRequirementsCount] = useState(propRequirementsCount ?? null);
  const [isLoading, setIsLoading] = useState(propRequirementsCount === undefined);

  // Fetch requirements count if not provided
  useEffect(() => {
    if (propRequirementsCount !== undefined) {
      setRequirementsCount(propRequirementsCount);
      setIsLoading(false);
      return;
    }

    const fetchRequirementsCount = async () => {
      try {
        const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:8000');
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${BASE_URL}/api/projects/${projectId}/requirements`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        });
        if (response.ok) {
          const data = await response.json();
          // Count all requirements across sections
          const count = Object.values(data).reduce((sum, section) => {
            return sum + (Array.isArray(section) ? section.length : 0);
          }, 0);
          setRequirementsCount(count);
        }
      } catch (error) {
        console.error('Failed to fetch requirements count:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRequirementsCount();
  }, [projectId, propRequirementsCount]);

  const handleGenerate = () => {
    if (onGenerate) {
      onGenerate(selectedMode);
    }
    onClose();
  };

  return (
    <Modal title="Generate PRD" onClose={onClose}>
      <div className="generate-prd-modal">
        <p className="generate-prd-modal__description">
          Generate a Product Requirements Document from your reviewed requirements.
        </p>

        {/* Requirements count badge */}
        <div className="generate-prd-modal__info">
          <span className="generate-prd-modal__info-icon">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 14A6 6 0 108 2a6 6 0 000 12z" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M8 5.5v3M8 10.5h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </span>
          {isLoading ? (
            <span className="generate-prd-modal__info-text">Loading requirements...</span>
          ) : (
            <span className="generate-prd-modal__info-text">
              {requirementsCount === null
                ? 'Unable to load requirements count'
                : `${requirementsCount} requirement${requirementsCount !== 1 ? 's' : ''} will be used to generate the PRD`}
            </span>
          )}
        </div>

        {/* Mode selection */}
        <div className="generate-prd-modal__field">
          <label className="generate-prd-modal__label">PRD Type</label>
          <div className="generate-prd-modal__options">
            {PRD_MODES.map((mode) => (
              <label
                key={mode.value}
                className={`generate-prd-modal__option ${
                  selectedMode === mode.value ? 'generate-prd-modal__option--selected' : ''
                }`}
              >
                <input
                  type="radio"
                  name="prd-mode"
                  value={mode.value}
                  checked={selectedMode === mode.value}
                  onChange={(e) => setSelectedMode(e.target.value)}
                  className="generate-prd-modal__radio"
                />
                <div className="generate-prd-modal__option-content">
                  <span className="generate-prd-modal__option-label">{mode.label}</span>
                  <span className="generate-prd-modal__option-description">{mode.description}</span>
                </div>
                <span className="generate-prd-modal__option-check">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M13.5 4.5L6 12L2.5 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="generate-prd-modal__actions">
          <button
            type="button"
            className="generate-prd-modal__cancel-btn"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="generate-prd-modal__generate-btn"
            onClick={handleGenerate}
            disabled={isLoading || requirementsCount === 0}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 1L10.5 6H14L11 9.5L12.5 15L8 11.5L3.5 15L5 9.5L2 6H5.5L8 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
            </svg>
            Generate PRD
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default GeneratePRDModal;
