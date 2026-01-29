import { useState } from 'react';
import Modal from '../common/Modal';
import './MockupDetailModal.css';

/**
 * Modal for viewing mockup details with full image and action buttons.
 *
 * @param {Object} props
 * @param {Object} props.mockup - The mockup data to display
 * @param {string} props.mockup.id - UUID of the mockup
 * @param {string} props.mockup.mockup_id - Formatted mockup ID (e.g., "MK-001")
 * @param {string} props.mockup.title - Mockup title
 * @param {string} props.mockup.description - Mockup description
 * @param {string} props.mockup.device - Target device (desktop, tablet, mobile)
 * @param {string} props.mockup.style - Visual style (modern, minimal, playful)
 * @param {string} props.mockup.thumbnail_url - URL to mockup image
 * @param {string} props.mockup.status - Mockup status (draft, ready, exported)
 * @param {function} props.onClose - Callback to close modal
 * @param {function} props.onRefine - Callback when refine button is clicked
 * @param {function} props.onVariations - Callback when variations button is clicked
 */
function MockupDetailModal({ mockup, onClose, onRefine, onVariations }) {
  const [isRefining, setIsRefining] = useState(false);
  const [isGeneratingVariations, setIsGeneratingVariations] = useState(false);
  const [refinePrompt, setRefinePrompt] = useState('');
  const [showRefineInput, setShowRefineInput] = useState(false);

  // Handle refine action
  const handleRefine = async () => {
    if (!onRefine || !refinePrompt.trim()) return;

    try {
      setIsRefining(true);
      await onRefine(mockup.id, refinePrompt.trim());
      setRefinePrompt('');
      setShowRefineInput(false);
    } catch (err) {
      console.error('Failed to refine mockup:', err);
    } finally {
      setIsRefining(false);
    }
  };

  // Handle variations action
  const handleVariations = async () => {
    if (!onVariations) return;

    try {
      setIsGeneratingVariations(true);
      await onVariations(mockup.id);
    } catch (err) {
      console.error('Failed to generate variations:', err);
    } finally {
      setIsGeneratingVariations(false);
    }
  };

  // Toggle refine input visibility
  const handleRefineClick = () => {
    setShowRefineInput(!showRefineInput);
  };

  // Device icon mapping
  const getDeviceIcon = (device) => {
    switch (device?.toLowerCase()) {
      case 'mobile':
        return (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="1" width="8" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="8" cy="12.5" r="0.75" fill="currentColor"/>
          </svg>
        );
      case 'tablet':
        return (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="1.5" width="12" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="8" cy="12" r="0.75" fill="currentColor"/>
          </svg>
        );
      case 'desktop':
      default:
        return (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="2" width="14" height="10" rx="1" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M5 14H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M8 12V14" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        );
    }
  };

  // Status badge class
  const getStatusClass = (status) => {
    switch (status?.toLowerCase()) {
      case 'ready':
        return 'mockup-detail__status--ready';
      case 'exported':
        return 'mockup-detail__status--exported';
      case 'draft':
      default:
        return 'mockup-detail__status--draft';
    }
  };

  // Style badge class
  const getStyleClass = (style) => {
    switch (style?.toLowerCase()) {
      case 'minimal':
        return 'mockup-detail__style--minimal';
      case 'playful':
        return 'mockup-detail__style--playful';
      case 'modern':
      default:
        return 'mockup-detail__style--modern';
    }
  };

  // Placeholder image for mockups without thumbnails
  const placeholderSvg = (
    <svg width="100%" height="100%" viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg" className="mockup-detail__placeholder-svg">
      <rect width="400" height="300" fill="#F3F4F6"/>
      <rect x="40" y="40" width="320" height="40" rx="4" fill="#E5E7EB"/>
      <rect x="40" y="100" width="200" height="24" rx="3" fill="#E5E7EB"/>
      <rect x="40" y="140" width="280" height="16" rx="2" fill="#E5E7EB"/>
      <rect x="40" y="170" width="240" height="16" rx="2" fill="#E5E7EB"/>
      <rect x="40" y="220" width="120" height="48" rx="4" fill="#D1D5DB"/>
    </svg>
  );

  // Icons
  const refineIcon = (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M11.333 2.667A1.886 1.886 0 0 1 14.667 5L5.333 14.333l-4 1 1-4L11.333 2.667z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  const variationsIcon = (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );

  return (
    <Modal title={mockup.title} onClose={onClose}>
      <div className="mockup-detail">
        {/* Header with metadata */}
        <div className="mockup-detail__header">
          <span className="mockup-detail__id">{mockup.mockup_id}</span>
          <span className={`mockup-detail__status ${getStatusClass(mockup.status)}`}>
            {mockup.status || 'draft'}
          </span>
        </div>

        {/* Full Image */}
        <div className="mockup-detail__image-container">
          {mockup.thumbnail_url ? (
            <img
              src={mockup.thumbnail_url}
              alt={mockup.title}
              className="mockup-detail__image"
            />
          ) : (
            <div className="mockup-detail__placeholder">
              {placeholderSvg}
            </div>
          )}
        </div>

        {/* Metadata badges */}
        <div className="mockup-detail__badges">
          <span className="mockup-detail__device">
            {getDeviceIcon(mockup.device)}
            <span>{mockup.device || 'desktop'}</span>
          </span>
          <span className={`mockup-detail__style ${getStyleClass(mockup.style)}`}>
            {mockup.style || 'modern'}
          </span>
        </div>

        {/* Description */}
        {mockup.description && (
          <p className="mockup-detail__description">{mockup.description}</p>
        )}

        {/* Refine input (shown when refine button is clicked) */}
        {showRefineInput && (
          <div className="mockup-detail__refine-section">
            <label className="mockup-detail__refine-label" htmlFor="refine-prompt">
              Describe the changes you want
            </label>
            <textarea
              id="refine-prompt"
              className="mockup-detail__refine-input"
              placeholder="e.g., Make the header larger, add a sidebar, change the color scheme..."
              value={refinePrompt}
              onChange={(e) => setRefinePrompt(e.target.value)}
              rows={3}
              autoFocus
            />
            <div className="mockup-detail__refine-actions">
              <button
                type="button"
                className="mockup-detail__refine-cancel"
                onClick={() => {
                  setShowRefineInput(false);
                  setRefinePrompt('');
                }}
                disabled={isRefining}
              >
                Cancel
              </button>
              <button
                type="button"
                className="mockup-detail__refine-submit"
                onClick={handleRefine}
                disabled={isRefining || !refinePrompt.trim()}
              >
                {isRefining ? 'Refining...' : 'Apply Changes'}
              </button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="mockup-detail__actions">
          <button
            type="button"
            className="mockup-detail__action-btn mockup-detail__action-btn--refine"
            onClick={handleRefineClick}
            disabled={isRefining || isGeneratingVariations}
          >
            {refineIcon}
            {showRefineInput ? 'Hide Refine' : 'Refine'}
          </button>
          <button
            type="button"
            className="mockup-detail__action-btn mockup-detail__action-btn--variations"
            onClick={handleVariations}
            disabled={isRefining || isGeneratingVariations}
          >
            {variationsIcon}
            {isGeneratingVariations ? 'Generating...' : 'Variations'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default MockupDetailModal;
