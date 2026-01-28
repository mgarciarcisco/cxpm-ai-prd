import React, { useState } from 'react';
import Modal from '../common/Modal';
import './GenerateStoriesModal.css';

// Story format options
const STORY_FORMATS = [
  {
    value: 'standard',
    label: 'Standard',
    description: 'Classic "As a user, I want..." format. Best for general requirements.',
  },
  {
    value: 'gherkin',
    label: 'Gherkin',
    description: 'Given/When/Then format. Best for behavior-driven development.',
  },
  {
    value: 'jtbd',
    label: 'Jobs to be Done',
    description: 'Focus on user goals and motivations. Best for product discovery.',
  },
];

// Include options for generated stories
const INCLUDE_OPTIONS = [
  {
    value: 'acceptance_criteria',
    label: 'Acceptance Criteria',
    description: 'Include detailed acceptance criteria for each story',
  },
  {
    value: 'size_estimate',
    label: 'Size Estimates',
    description: 'Include T-shirt size estimates (XS, S, M, L, XL)',
  },
  {
    value: 'priority',
    label: 'Priority',
    description: 'Include priority levels (High, Medium, Low)',
  },
];

/**
 * Modal for selecting user story generation options.
 * Allows choosing story format and what to include in generated stories.
 *
 * @param {object} props
 * @param {string} props.projectId - Project ID for API call
 * @param {function} props.onClose - Callback to close modal
 * @param {function} props.onGenerate - Callback when generation starts (receives options)
 */
function GenerateStoriesModal({ projectId: _projectId, onClose, onGenerate }) {
  const [selectedFormat, setSelectedFormat] = useState('standard');
  const [includeOptions, setIncludeOptions] = useState({
    acceptance_criteria: true,
    size_estimate: false,
    priority: false,
  });

  const handleIncludeChange = (optionValue) => {
    setIncludeOptions((prev) => ({
      ...prev,
      [optionValue]: !prev[optionValue],
    }));
  };

  const handleGenerate = () => {
    if (onGenerate) {
      onGenerate({
        format: selectedFormat,
        include: includeOptions,
      });
    }
    onClose();
  };

  // Checkmark icon for selected format
  const checkIcon = (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M13.5 4.5L6 12L2.5 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  // Sparkle icon for generate button
  const sparkleIcon = (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 1L10.5 6H14L11 9.5L12.5 15L8 11.5L3.5 15L5 9.5L2 6H5.5L8 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  );

  return (
    <Modal title="Generate User Stories" onClose={onClose}>
      <div className="generate-stories-modal">
        <p className="generate-stories-modal__description">
          Generate user stories from your PRD. Choose a format and what details to include.
        </p>

        {/* Format selection */}
        <div className="generate-stories-modal__field">
          <label className="generate-stories-modal__label">Story Format</label>
          <div className="generate-stories-modal__options">
            {STORY_FORMATS.map((format) => (
              <label
                key={format.value}
                className={`generate-stories-modal__option ${
                  selectedFormat === format.value ? 'generate-stories-modal__option--selected' : ''
                }`}
              >
                <input
                  type="radio"
                  name="story-format"
                  value={format.value}
                  checked={selectedFormat === format.value}
                  onChange={(e) => setSelectedFormat(e.target.value)}
                  className="generate-stories-modal__radio"
                />
                <div className="generate-stories-modal__option-content">
                  <span className="generate-stories-modal__option-label">{format.label}</span>
                  <span className="generate-stories-modal__option-description">{format.description}</span>
                </div>
                <span className="generate-stories-modal__option-check">
                  {checkIcon}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Include options (checkboxes) */}
        <div className="generate-stories-modal__field">
          <label className="generate-stories-modal__label">Include in Stories</label>
          <div className="generate-stories-modal__checkboxes">
            {INCLUDE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`generate-stories-modal__checkbox ${
                  includeOptions[option.value] ? 'generate-stories-modal__checkbox--checked' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={includeOptions[option.value]}
                  onChange={() => handleIncludeChange(option.value)}
                  className="generate-stories-modal__checkbox-input"
                />
                <span className="generate-stories-modal__checkbox-box">
                  {includeOptions[option.value] && checkIcon}
                </span>
                <div className="generate-stories-modal__checkbox-content">
                  <span className="generate-stories-modal__checkbox-label">{option.label}</span>
                  <span className="generate-stories-modal__checkbox-description">{option.description}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="generate-stories-modal__actions">
          <button
            type="button"
            className="generate-stories-modal__cancel-btn"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="generate-stories-modal__generate-btn"
            onClick={handleGenerate}
          >
            {sparkleIcon}
            Generate Stories
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default GenerateStoriesModal;
