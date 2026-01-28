import React, { useState } from 'react';
import Modal from '../common/Modal';
import './DescribeUIModal.css';

// Style options for mockup generation (same as GenerateFromStoriesModal)
const STYLE_OPTIONS = [
  { id: 'minimal', label: 'Minimal', description: 'Clean, simple design with lots of whitespace' },
  { id: 'modern', label: 'Modern', description: 'Contemporary design with subtle shadows and gradients' },
  { id: 'corporate', label: 'Corporate', description: 'Professional design suitable for business applications' },
  { id: 'playful', label: 'Playful', description: 'Fun, colorful design with rounded elements' },
];

// Device options for mockup generation
const DEVICE_OPTIONS = [
  { id: 'desktop', label: 'Desktop' },
  { id: 'tablet', label: 'Tablet' },
  { id: 'mobile', label: 'Mobile' },
];

/**
 * Modal for describing a UI mockup manually.
 * Allows entering a title, description, selecting style, and device type.
 *
 * @param {object} props
 * @param {string} props.projectId - Project ID for the mockup
 * @param {function} props.onClose - Callback to close modal
 * @param {function} props.onGenerate - Callback when generation starts (receives options)
 */
function DescribeUIModal({ projectId: _projectId, onClose, onGenerate }) {
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('modern');
  const [selectedDevices, setSelectedDevices] = useState(['desktop']);

  // Toggle device selection
  const handleDeviceToggle = (deviceId) => {
    setSelectedDevices(prev => {
      if (prev.includes(deviceId)) {
        // Don't allow deselecting the last device
        if (prev.length === 1) return prev;
        return prev.filter(d => d !== deviceId);
      }
      return [...prev, deviceId];
    });
  };

  // Handle generate button click
  const handleGenerate = () => {
    if (!title.trim() || !description.trim()) return;

    if (onGenerate) {
      onGenerate({
        title: title.trim(),
        description: description.trim(),
        style: selectedStyle,
        devices: selectedDevices,
      });
    }
    onClose();
  };

  // Check if form is valid
  const isValid = title.trim().length > 0 && description.trim().length > 0;

  // Checkmark icon for selected items
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

  // Device icons
  const deviceIcons = {
    desktop: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
    tablet: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
        <line x1="12" y1="18" x2="12.01" y2="18" />
      </svg>
    ),
    mobile: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
        <line x1="12" y1="18" x2="12.01" y2="18" />
      </svg>
    ),
  };

  return (
    <Modal title="Describe UI Mockup" onClose={onClose}>
      <div className="describe-ui-modal">
        <p className="describe-ui-modal__description">
          Describe the UI you want to create. Be specific about layout, components, and functionality.
        </p>

        {/* Title Input */}
        <div className="describe-ui-modal__field">
          <label className="describe-ui-modal__label" htmlFor="mockup-title">
            Mockup Title
          </label>
          <input
            id="mockup-title"
            type="text"
            className="describe-ui-modal__input"
            placeholder="e.g., User Dashboard, Login Page, Settings Panel..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </div>

        {/* Description Input */}
        <div className="describe-ui-modal__field">
          <label className="describe-ui-modal__label" htmlFor="mockup-description">
            UI Description
          </label>
          <textarea
            id="mockup-description"
            className="describe-ui-modal__textarea"
            placeholder="Describe the UI in detail. Include layout, components, interactions, and any specific requirements..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
          />
        </div>

        {/* Style Selection */}
        <div className="describe-ui-modal__field">
          <label className="describe-ui-modal__label">Visual Style</label>
          <div className="describe-ui-modal__options">
            {STYLE_OPTIONS.map((style) => (
              <label
                key={style.id}
                className={`describe-ui-modal__option ${
                  selectedStyle === style.id ? 'describe-ui-modal__option--selected' : ''
                }`}
              >
                <input
                  type="radio"
                  name="mockup-style"
                  value={style.id}
                  checked={selectedStyle === style.id}
                  onChange={(e) => setSelectedStyle(e.target.value)}
                  className="describe-ui-modal__radio"
                />
                <div className="describe-ui-modal__option-content">
                  <span className="describe-ui-modal__option-label">{style.label}</span>
                  <span className="describe-ui-modal__option-description">{style.description}</span>
                </div>
                <span className="describe-ui-modal__option-check">
                  {checkIcon}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Device Selection */}
        <div className="describe-ui-modal__field">
          <label className="describe-ui-modal__label">Target Devices (select one or more)</label>
          <div className="describe-ui-modal__devices">
            {DEVICE_OPTIONS.map((device) => (
              <button
                key={device.id}
                type="button"
                className={`describe-ui-modal__device-btn ${
                  selectedDevices.includes(device.id) ? 'describe-ui-modal__device-btn--active' : ''
                }`}
                onClick={() => handleDeviceToggle(device.id)}
                aria-pressed={selectedDevices.includes(device.id)}
              >
                {deviceIcons[device.id]}
                <span>{device.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="describe-ui-modal__actions">
          <button
            type="button"
            className="describe-ui-modal__cancel-btn"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="describe-ui-modal__generate-btn"
            onClick={handleGenerate}
            disabled={!isValid}
          >
            {sparkleIcon}
            Generate Mockup
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default DescribeUIModal;
