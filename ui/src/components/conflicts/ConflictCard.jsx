import { useState } from 'react';
import './ConflictCard.css';

/**
 * ConflictCard component displays a single conflict between a new meeting item
 * and an existing requirement, with resolution options.
 *
 * @param {Object} conflict - The conflict data from the apply endpoint
 * @param {string} conflict.item_id - ID of the new meeting item
 * @param {string} conflict.item_section - Section of the new item
 * @param {string} conflict.item_content - Content of the new item
 * @param {string} conflict.classification - AI classification: 'refinement' or 'contradiction'
 * @param {string} conflict.reason - AI reasoning for the classification
 * @param {Object} conflict.matched_requirement - The existing requirement that conflicts
 * @param {string} conflict.matched_requirement.id - ID of the existing requirement
 * @param {string} conflict.matched_requirement.content - Content of the existing requirement
 * @param {string} selectedResolution - Currently selected resolution option
 * @param {function} onResolutionChange - Callback when resolution is changed
 * @param {function} formatSection - Function to format section enum to display text
 */
export function ConflictCard({
  conflict,
  selectedResolution,
  onResolutionChange,
  formatSection
}) {
  const [expanded, setExpanded] = useState(true);

  const resolutionOptions = [
    { value: 'conflict_keep_existing', label: 'Keep existing', description: 'Discard the new item and keep the current requirement as-is' },
    { value: 'conflict_replaced', label: 'Replace', description: 'Replace the existing requirement with the new item' },
    { value: 'conflict_kept_both', label: 'Keep both', description: 'Add the new item as a separate requirement alongside the existing one' },
    { value: 'conflict_merged', label: 'Merge', description: 'Combine both into a single merged requirement' },
  ];

  // Determine AI recommendation based on classification
  const getAIRecommendation = () => {
    if (conflict.classification === 'refinement') {
      return {
        option: 'conflict_replaced',
        text: 'Replace with new version',
        explanation: 'The new item appears to be a refinement that adds more detail or clarity.'
      };
    } else if (conflict.classification === 'contradiction') {
      return {
        option: 'conflict_keep_existing',
        text: 'Keep existing',
        explanation: 'The items contradict each other. Review carefully before deciding.'
      };
    }
    return {
      option: null,
      text: 'Review manually',
      explanation: 'Unable to determine automatic recommendation.'
    };
  };

  const aiRecommendation = getAIRecommendation();

  const handleOptionChange = (value) => {
    if (onResolutionChange) {
      onResolutionChange(conflict.item_id, value);
    }
  };

  return (
    <div className="conflict-card">
      <div className="conflict-card-header" onClick={() => setExpanded(!expanded)}>
        <div className="conflict-card-header-content">
          <div className="conflict-card-title">
            <span className={`conflict-card-classification conflict-card-classification--${conflict.classification}`}>
              {conflict.classification === 'refinement' ? 'Refinement' : 'Contradiction'}
            </span>
            <span className="conflict-card-section">
              {formatSection ? formatSection(conflict.item_section) : conflict.item_section}
            </span>
          </div>
          <button
            className="conflict-card-expand-btn"
            aria-label={expanded ? 'Collapse' : 'Expand'}
            type="button"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className={`conflict-card-expand-icon ${expanded ? 'conflict-card-expand-icon--expanded' : ''}`}
            >
              <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      {expanded && (
        <div className="conflict-card-body">
          {/* Side-by-side comparison */}
          <div className="conflict-card-comparison">
            <div className="conflict-card-panel conflict-card-panel--existing">
              <div className="conflict-card-panel-header">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 14C11.3137 14 14 11.3137 14 8C14 4.68629 11.3137 2 8 2C4.68629 2 2 4.68629 2 8C2 11.3137 4.68629 14 8 14Z" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M8 5V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M8 11H8.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <span>Existing Requirement</span>
              </div>
              <div className="conflict-card-panel-content">
                {conflict.matched_requirement?.content || 'No existing content'}
              </div>
            </div>

            <div className="conflict-card-panel conflict-card-panel--new">
              <div className="conflict-card-panel-header">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 3V13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M3 8H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <span>New Item</span>
              </div>
              <div className="conflict-card-panel-content">
                {conflict.item_content}
              </div>
            </div>
          </div>

          {/* AI Recommendation */}
          <div className="conflict-card-recommendation">
            <div className="conflict-card-recommendation-header">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 1L10.163 5.27865L15 6.11146L11.5 9.45085L12.326 14L8 11.8787L3.674 14L4.5 9.45085L1 6.11146L5.837 5.27865L8 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>AI Recommendation: {aiRecommendation.text}</span>
            </div>
            <p className="conflict-card-recommendation-reason">
              {conflict.reason || aiRecommendation.explanation}
            </p>
          </div>

          {/* Resolution Options */}
          <div className="conflict-card-options">
            <div className="conflict-card-options-label">Choose resolution:</div>
            <div className="conflict-card-options-grid">
              {resolutionOptions.map((option) => (
                <label
                  key={option.value}
                  className={`conflict-card-option ${selectedResolution === option.value ? 'conflict-card-option--selected' : ''} ${aiRecommendation.option === option.value ? 'conflict-card-option--recommended' : ''}`}
                >
                  <input
                    type="radio"
                    name={`resolution-${conflict.item_id}`}
                    value={option.value}
                    checked={selectedResolution === option.value}
                    onChange={() => handleOptionChange(option.value)}
                    className="conflict-card-option-radio"
                  />
                  <div className="conflict-card-option-content">
                    <span className="conflict-card-option-label">
                      {option.label}
                      {aiRecommendation.option === option.value && (
                        <span className="conflict-card-option-badge">Recommended</span>
                      )}
                    </span>
                    <span className="conflict-card-option-description">{option.description}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ConflictCard;
