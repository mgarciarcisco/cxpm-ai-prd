import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './QuickConvertMockupsPage.css';

// Input source options
const INPUT_SOURCES = {
  stories: { id: 'stories', label: 'User Stories', placeholder: 'Paste user stories here to generate mockups from...' },
  description: { id: 'description', label: 'Description', placeholder: 'Describe the UI you want to generate. Be specific about layout, components, and functionality...' },
};

// Style options
const STYLE_OPTIONS = [
  { id: 'minimal', label: 'Minimal', description: 'Clean, simple design with lots of whitespace' },
  { id: 'modern', label: 'Modern', description: 'Contemporary design with subtle shadows and gradients' },
  { id: 'corporate', label: 'Corporate', description: 'Professional design suitable for business applications' },
  { id: 'playful', label: 'Playful', description: 'Fun, colorful design with rounded elements' },
];

// Device options
const DEVICE_OPTIONS = [
  { id: 'desktop', label: 'Desktop', icon: 'desktop' },
  { id: 'tablet', label: 'Tablet', icon: 'tablet' },
  { id: 'mobile', label: 'Mobile', icon: 'mobile' },
];

/**
 * Quick Convert Mockups page - input UI for generating mockups.
 * Allows users to generate UI mockups from user stories or descriptions.
 * Can receive pre-filled stories via navigation state.
 */
function QuickConvertMockupsPage() {
  const location = useLocation();
  const [content, setContent] = useState('');
  const [inputSource, setInputSource] = useState('stories');
  const [fromPreviousStep, setFromPreviousStep] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState('modern');
  const [selectedDevices, setSelectedDevices] = useState(['desktop']);
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState(null);
  const [fileError, setFileError] = useState(null);
  const fileInputRef = useRef(null);

  // Pre-fill content if navigated from stories page
  useEffect(() => {
    if (location.state?.storiesText) {
      setContent(location.state.storiesText);
      setInputSource('stories');
      setFromPreviousStep(true);
    }
  }, [location.state]);

  const hasContent = content.trim().length > 0;

  // Supported file types
  const ACCEPTED_FILE_TYPES = ['.txt', '.md'];
  const ACCEPTED_MIME_TYPES = ['text/plain', 'text/markdown'];

  const isValidFileType = (file) => {
    const extension = '.' + file.name.split('.').pop().toLowerCase();
    return ACCEPTED_FILE_TYPES.includes(extension) || ACCEPTED_MIME_TYPES.includes(file.type);
  };

  const handleFileRead = (file) => {
    if (!isValidFileType(file)) {
      setFileError('Invalid file type. Please upload a .txt or .md file.');
      return;
    }

    setFileError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      setContent(e.target.result);
      setFileName(file.name);
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileRead(file);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileRead(file);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleClearFile = () => {
    setFileName(null);
    setContent('');
    setFileError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDeviceToggle = (deviceId) => {
    setSelectedDevices((prev) => {
      if (prev.includes(deviceId)) {
        // Don't allow deselecting the last device
        if (prev.length === 1) return prev;
        return prev.filter((d) => d !== deviceId);
      }
      return [...prev, deviceId];
    });
  };

  const handleGenerate = () => {
    if (!hasContent) return;
    // Generation logic will be implemented in P4-005b
    console.log('Generating mockup with:', {
      content,
      inputSource,
      selectedStyle,
      selectedDevices,
    });
  };

  // Device icons
  const renderDeviceIcon = (iconType) => {
    switch (iconType) {
      case 'desktop':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        );
      case 'tablet':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
            <line x1="12" y1="18" x2="12.01" y2="18" />
          </svg>
        );
      case 'mobile':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
            <line x1="12" y1="18" x2="12.01" y2="18" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <main className="main-content">
      <section className="qc-mockups">
        {/* Back Link */}
        <Link to="/quick-convert" className="qc-mockups__back-link">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to Quick Convert
        </Link>

        {/* Header */}
        <div className="qc-mockups__header">
          <div className="qc-mockups__icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
              <path d="M3 9H21" stroke="currentColor" strokeWidth="2"/>
              <circle cx="6" cy="6" r="1" fill="currentColor"/>
              <circle cx="9" cy="6" r="1" fill="currentColor"/>
              <path d="M8 15L10 13L13 16L16 12L18 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="qc-mockups__header-content">
            <h1 className="qc-mockups__title">Design Mockups</h1>
            <p className="qc-mockups__subtitle">
              Generate UI mockups from user stories or feature descriptions using AI.
            </p>
          </div>
        </div>

        {/* Input Section */}
        <div className="qc-mockups__input-section">
          {/* Input Source Toggle */}
          <div className="qc-mockups__toggle-group">
            <span className="qc-mockups__toggle-label">Input Source</span>
            <div className="qc-mockups__toggle-buttons">
              {Object.values(INPUT_SOURCES).map((source) => (
                <button
                  key={source.id}
                  type="button"
                  className={`qc-mockups__toggle-btn ${inputSource === source.id ? 'qc-mockups__toggle-btn--active' : ''}`}
                  onClick={() => setInputSource(source.id)}
                >
                  {source.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content Area */}
          <div className="qc-mockups__content-area">
            <label htmlFor="mockups-content" className="qc-mockups__label">
              {INPUT_SOURCES[inputSource].label}
            </label>
            {fromPreviousStep && (
              <div className="qc-mockups__chained-indicator">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                <span>Using data from previous step</span>
              </div>
            )}
            <textarea
              id="mockups-content"
              className="qc-mockups__textarea"
              placeholder={INPUT_SOURCES[inputSource].placeholder}
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                if (fileName) setFileName(null);
                if (fromPreviousStep) setFromPreviousStep(false);
              }}
              rows={10}
            />
          </div>

          <div className="qc-mockups__divider">
            <span>or</span>
          </div>

          {/* File Upload Zone */}
          <div
            className={`qc-mockups__upload-zone ${dragActive ? 'qc-mockups__upload-zone--active' : ''}`}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={handleUploadClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handleUploadClick();
              }
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              onChange={handleFileChange}
              className="qc-mockups__file-input"
              aria-label="Upload file"
            />
            <svg
              className="qc-mockups__upload-icon"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span className="qc-mockups__upload-text">
              {dragActive ? 'Drop file here' : 'Click or drag file here'}
            </span>
            <span className="qc-mockups__upload-hint">
              Supports .txt and .md files
            </span>
          </div>

          {fileError && (
            <div className="qc-mockups__error" role="alert">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{fileError}</span>
            </div>
          )}

          {fileName && (
            <div className="qc-mockups__file-info">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span className="qc-mockups__file-name">{fileName}</span>
              <button
                type="button"
                className="qc-mockups__file-clear"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClearFile();
                }}
                aria-label="Clear file"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Options Section */}
        <div className="qc-mockups__options-section">
          {/* Style Selection */}
          <div className="qc-mockups__option-group">
            <span className="qc-mockups__option-label">Style</span>
            <div className="qc-mockups__style-options">
              {STYLE_OPTIONS.map((style) => (
                <label key={style.id} className="qc-mockups__style-option">
                  <input
                    type="radio"
                    name="mockup-style"
                    value={style.id}
                    checked={selectedStyle === style.id}
                    onChange={(e) => setSelectedStyle(e.target.value)}
                    className="qc-mockups__style-radio"
                  />
                  <div className="qc-mockups__style-content">
                    <span className="qc-mockups__style-label">{style.label}</span>
                    <span className="qc-mockups__style-description">{style.description}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Device Selection */}
          <div className="qc-mockups__option-group">
            <span className="qc-mockups__option-label">Device (select one or more)</span>
            <div className="qc-mockups__device-options">
              {DEVICE_OPTIONS.map((device) => (
                <button
                  key={device.id}
                  type="button"
                  className={`qc-mockups__device-btn ${selectedDevices.includes(device.id) ? 'qc-mockups__device-btn--active' : ''}`}
                  onClick={() => handleDeviceToggle(device.id)}
                  aria-pressed={selectedDevices.includes(device.id)}
                >
                  {renderDeviceIcon(device.icon)}
                  <span>{device.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="qc-mockups__actions">
          <button
            type="button"
            className="qc-mockups__generate-btn"
            onClick={handleGenerate}
            disabled={!hasContent}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
              <path d="M3 9H21" stroke="currentColor" strokeWidth="2"/>
              <circle cx="6" cy="6" r="1" fill="currentColor"/>
              <circle cx="9" cy="6" r="1" fill="currentColor"/>
              <path d="M8 15L10 13L13 16L16 12L18 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Generate Mockup
          </button>
        </div>
      </section>
    </main>
  );
}

export default QuickConvertMockupsPage;
