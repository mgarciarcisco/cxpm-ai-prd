import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { listStories } from '../../services/api';
import './GenerateFromStoriesModal.css';

// Style options for mockup generation
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
 * Modal for selecting user stories and options for mockup generation.
 * Allows choosing which stories to include, style, and device type.
 *
 * @param {object} props
 * @param {string} props.projectId - Project ID for fetching stories
 * @param {function} props.onClose - Callback to close modal
 * @param {function} props.onGenerate - Callback when generation starts (receives options)
 */
function GenerateFromStoriesModal({ projectId, onClose, onGenerate }) {
  // Stories state
  const [stories, setStories] = useState([]);
  const [loadingStories, setLoadingStories] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Selection state
  const [selectedStoryIds, setSelectedStoryIds] = useState(new Set());
  const [selectedStyle, setSelectedStyle] = useState('modern');
  const [selectedDevices, setSelectedDevices] = useState(['desktop']);

  // Load stories on mount
  useEffect(() => {
    async function loadStories() {
      if (!projectId) return;

      try {
        setLoadingStories(true);
        setLoadError(null);
        const response = await listStories(projectId, { limit: 100 });
        const storyList = response.items || [];
        setStories(storyList);
        // Select all stories by default
        setSelectedStoryIds(new Set(storyList.map(s => s.id)));
      } catch (err) {
        console.error('Failed to load stories:', err);
        setLoadError('Failed to load stories. Please try again.');
      } finally {
        setLoadingStories(false);
      }
    }

    loadStories();
  }, [projectId]);

  // Toggle story selection
  const handleStoryToggle = (storyId) => {
    setSelectedStoryIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(storyId)) {
        newSet.delete(storyId);
      } else {
        newSet.add(storyId);
      }
      return newSet;
    });
  };

  // Select/deselect all stories
  const handleSelectAll = () => {
    if (selectedStoryIds.size === stories.length) {
      // Deselect all
      setSelectedStoryIds(new Set());
    } else {
      // Select all
      setSelectedStoryIds(new Set(stories.map(s => s.id)));
    }
  };

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
    if (selectedStoryIds.size === 0) return;

    const selectedStories = stories.filter(s => selectedStoryIds.has(s.id));

    if (onGenerate) {
      onGenerate({
        stories: selectedStories,
        style: selectedStyle,
        devices: selectedDevices,
      });
    }
    onClose();
  };

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

  const allSelected = selectedStoryIds.size === stories.length && stories.length > 0;

  return (
    <Modal title="Generate Mockups from Stories" onClose={onClose}>
      <div className="generate-mockups-modal">
        <p className="generate-mockups-modal__description">
          Select user stories to generate UI mockups. Choose a visual style and target devices.
        </p>

        {/* Story Selection */}
        <div className="generate-mockups-modal__field">
          <div className="generate-mockups-modal__label-row">
            <label className="generate-mockups-modal__label">
              Select Stories ({selectedStoryIds.size} of {stories.length})
            </label>
            {stories.length > 0 && (
              <button
                type="button"
                className="generate-mockups-modal__select-all-btn"
                onClick={handleSelectAll}
              >
                {allSelected ? 'Deselect All' : 'Select All'}
              </button>
            )}
          </div>

          <div className="generate-mockups-modal__stories-list">
            {loadingStories ? (
              <div className="generate-mockups-modal__loading">
                <div className="generate-mockups-modal__spinner" />
                <span>Loading stories...</span>
              </div>
            ) : loadError ? (
              <div className="generate-mockups-modal__error">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{loadError}</span>
              </div>
            ) : stories.length === 0 ? (
              <div className="generate-mockups-modal__empty">
                <span>No user stories found. Generate stories first.</span>
              </div>
            ) : (
              stories.map((story) => (
                <label
                  key={story.id}
                  className={`generate-mockups-modal__story-item ${
                    selectedStoryIds.has(story.id) ? 'generate-mockups-modal__story-item--selected' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedStoryIds.has(story.id)}
                    onChange={() => handleStoryToggle(story.id)}
                    className="generate-mockups-modal__story-checkbox"
                  />
                  <span className="generate-mockups-modal__story-check">
                    {selectedStoryIds.has(story.id) && checkIcon}
                  </span>
                  <div className="generate-mockups-modal__story-content">
                    <span className="generate-mockups-modal__story-id">{story.story_id}</span>
                    <span className="generate-mockups-modal__story-title">{story.title}</span>
                  </div>
                </label>
              ))
            )}
          </div>
        </div>

        {/* Style Selection */}
        <div className="generate-mockups-modal__field">
          <label className="generate-mockups-modal__label">Visual Style</label>
          <div className="generate-mockups-modal__options">
            {STYLE_OPTIONS.map((style) => (
              <label
                key={style.id}
                className={`generate-mockups-modal__option ${
                  selectedStyle === style.id ? 'generate-mockups-modal__option--selected' : ''
                }`}
              >
                <input
                  type="radio"
                  name="mockup-style"
                  value={style.id}
                  checked={selectedStyle === style.id}
                  onChange={(e) => setSelectedStyle(e.target.value)}
                  className="generate-mockups-modal__radio"
                />
                <div className="generate-mockups-modal__option-content">
                  <span className="generate-mockups-modal__option-label">{style.label}</span>
                  <span className="generate-mockups-modal__option-description">{style.description}</span>
                </div>
                <span className="generate-mockups-modal__option-check">
                  {checkIcon}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Device Selection */}
        <div className="generate-mockups-modal__field">
          <label className="generate-mockups-modal__label">Target Devices (select one or more)</label>
          <div className="generate-mockups-modal__devices">
            {DEVICE_OPTIONS.map((device) => (
              <button
                key={device.id}
                type="button"
                className={`generate-mockups-modal__device-btn ${
                  selectedDevices.includes(device.id) ? 'generate-mockups-modal__device-btn--active' : ''
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
        <div className="generate-mockups-modal__actions">
          <button
            type="button"
            className="generate-mockups-modal__cancel-btn"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="generate-mockups-modal__generate-btn"
            onClick={handleGenerate}
            disabled={selectedStoryIds.size === 0 || loadingStories}
          >
            {sparkleIcon}
            Generate Mockups
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default GenerateFromStoriesModal;
