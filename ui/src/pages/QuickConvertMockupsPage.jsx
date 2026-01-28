import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './QuickConvertMockupsPage.css';

// Placeholder mockup images for simulation
const PLACEHOLDER_MOCKUPS = {
  desktop: 'data:image/svg+xml,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
      <rect fill="#f3f4f6" width="1200" height="800"/>
      <rect fill="#ffffff" x="20" y="20" width="1160" height="60" rx="8"/>
      <rect fill="#f97316" x="40" y="35" width="100" height="30" rx="4"/>
      <rect fill="#e5e7eb" x="160" y="40" width="80" height="20" rx="4"/>
      <rect fill="#e5e7eb" x="260" y="40" width="80" height="20" rx="4"/>
      <rect fill="#e5e7eb" x="360" y="40" width="80" height="20" rx="4"/>
      <rect fill="#f97316" x="1060" y="35" width="100" height="30" rx="4"/>
      <rect fill="#ffffff" x="20" y="100" width="280" height="680" rx="8"/>
      <rect fill="#fff7ed" x="40" y="120" width="240" height="40" rx="4"/>
      <rect fill="#e5e7eb" x="40" y="180" width="200" height="20" rx="4"/>
      <rect fill="#e5e7eb" x="40" y="210" width="180" height="20" rx="4"/>
      <rect fill="#e5e7eb" x="40" y="240" width="220" height="20" rx="4"/>
      <rect fill="#e5e7eb" x="40" y="300" width="200" height="20" rx="4"/>
      <rect fill="#e5e7eb" x="40" y="330" width="180" height="20" rx="4"/>
      <rect fill="#ffffff" x="320" y="100" width="860" height="680" rx="8"/>
      <rect fill="#f9fafb" x="340" y="120" width="820" height="200" rx="8"/>
      <text x="750" y="230" fill="#9ca3af" font-family="Arial, sans-serif" font-size="24" text-anchor="middle">Hero Section</text>
      <rect fill="#f9fafb" x="340" y="340" width="260" height="180" rx="8"/>
      <rect fill="#f9fafb" x="620" y="340" width="260" height="180" rx="8"/>
      <rect fill="#f9fafb" x="900" y="340" width="260" height="180" rx="8"/>
      <text x="470" y="440" fill="#9ca3af" font-family="Arial, sans-serif" font-size="14" text-anchor="middle">Feature Card 1</text>
      <text x="750" y="440" fill="#9ca3af" font-family="Arial, sans-serif" font-size="14" text-anchor="middle">Feature Card 2</text>
      <text x="1030" y="440" fill="#9ca3af" font-family="Arial, sans-serif" font-size="14" text-anchor="middle">Feature Card 3</text>
      <rect fill="#f9fafb" x="340" y="540" width="820" height="220" rx="8"/>
      <text x="750" y="660" fill="#9ca3af" font-family="Arial, sans-serif" font-size="20" text-anchor="middle">Content Section</text>
    </svg>
  `),
  tablet: 'data:image/svg+xml,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="768" height="1024" viewBox="0 0 768 1024">
      <rect fill="#f3f4f6" width="768" height="1024"/>
      <rect fill="#ffffff" x="20" y="20" width="728" height="60" rx="8"/>
      <rect fill="#f97316" x="40" y="35" width="80" height="30" rx="4"/>
      <rect fill="#e5e7eb" x="608" y="35" width="120" height="30" rx="4"/>
      <rect fill="#ffffff" x="20" y="100" width="728" height="300" rx="8"/>
      <text x="384" y="260" fill="#9ca3af" font-family="Arial, sans-serif" font-size="24" text-anchor="middle">Hero Section</text>
      <rect fill="#ffffff" x="20" y="420" width="354" height="200" rx="8"/>
      <rect fill="#ffffff" x="394" y="420" width="354" height="200" rx="8"/>
      <text x="197" y="530" fill="#9ca3af" font-family="Arial, sans-serif" font-size="14" text-anchor="middle">Feature Card 1</text>
      <text x="571" y="530" fill="#9ca3af" font-family="Arial, sans-serif" font-size="14" text-anchor="middle">Feature Card 2</text>
      <rect fill="#ffffff" x="20" y="640" width="728" height="200" rx="8"/>
      <text x="384" y="750" fill="#9ca3af" font-family="Arial, sans-serif" font-size="18" text-anchor="middle">Content Section</text>
      <rect fill="#ffffff" x="20" y="860" width="728" height="140" rx="8"/>
      <text x="384" y="940" fill="#9ca3af" font-family="Arial, sans-serif" font-size="14" text-anchor="middle">Footer</text>
    </svg>
  `),
  mobile: 'data:image/svg+xml,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="375" height="812" viewBox="0 0 375 812">
      <rect fill="#f3f4f6" width="375" height="812"/>
      <rect fill="#ffffff" x="15" y="15" width="345" height="50" rx="8"/>
      <rect fill="#f97316" x="25" y="27" width="60" height="26" rx="4"/>
      <rect fill="#e5e7eb" x="300" y="27" width="50" height="26" rx="4"/>
      <rect fill="#ffffff" x="15" y="80" width="345" height="180" rx="8"/>
      <text x="187" y="180" fill="#9ca3af" font-family="Arial, sans-serif" font-size="16" text-anchor="middle">Hero Section</text>
      <rect fill="#ffffff" x="15" y="275" width="345" height="120" rx="8"/>
      <text x="187" y="345" fill="#9ca3af" font-family="Arial, sans-serif" font-size="12" text-anchor="middle">Feature Card 1</text>
      <rect fill="#ffffff" x="15" y="410" width="345" height="120" rx="8"/>
      <text x="187" y="480" fill="#9ca3af" font-family="Arial, sans-serif" font-size="12" text-anchor="middle">Feature Card 2</text>
      <rect fill="#ffffff" x="15" y="545" width="345" height="120" rx="8"/>
      <text x="187" y="615" fill="#9ca3af" font-family="Arial, sans-serif" font-size="12" text-anchor="middle">Feature Card 3</text>
      <rect fill="#ffffff" x="15" y="680" width="345" height="117" rx="8"/>
      <text x="187" y="745" fill="#9ca3af" font-family="Arial, sans-serif" font-size="12" text-anchor="middle">Footer</text>
    </svg>
  `),
};

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

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState(null);
  const [generatedMockups, setGeneratedMockups] = useState(null);
  const [generationProgress, setGenerationProgress] = useState(0);

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

  // Simulate mockup generation with progress
  const simulateGeneration = useCallback(async () => {
    const totalDevices = selectedDevices.length;
    setGenerationProgress(0);

    const mockups = [];

    for (let i = 0; i < totalDevices; i++) {
      const device = selectedDevices[i];
      // Simulate delay per device (800-1200ms)
      await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400));

      mockups.push({
        id: `mockup-${Date.now()}-${device}`,
        device,
        style: selectedStyle,
        imageUrl: PLACEHOLDER_MOCKUPS[device],
        createdAt: new Date().toISOString(),
      });

      setGenerationProgress(i + 1);
    }

    return mockups;
  }, [selectedDevices, selectedStyle]);

  const handleGenerate = async () => {
    if (!hasContent) return;

    setIsGenerating(true);
    setGenerationError(null);
    setGeneratedMockups(null);
    setGenerationProgress(0);

    try {
      const mockups = await simulateGeneration();
      setGeneratedMockups(mockups);
    } catch (error) {
      setGenerationError(error.message || 'Generation failed. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRetry = () => {
    handleGenerate();
  };

  const handleStartOver = () => {
    setGeneratedMockups(null);
    setContent('');
    setFileName(null);
    setGenerationError(null);
    setGenerationProgress(0);
    setFromPreviousStep(false);
  };

  const handleDownload = (mockup) => {
    // Create a download link for the mockup image
    const link = document.createElement('a');
    link.href = mockup.imageUrl;
    link.download = `mockup-${mockup.device}-${mockup.style}-${Date.now()}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAll = () => {
    if (!generatedMockups?.length) return;
    generatedMockups.forEach((mockup, index) => {
      setTimeout(() => handleDownload(mockup), index * 200);
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

  // Render generation progress
  const renderGenerating = () => (
    <div className="qc-mockups__generation">
      <div className="qc-mockups__generation-content">
        <div className="qc-mockups__spinner" />
        <h2 className="qc-mockups__generation-title">Generating Mockups</h2>
        <p className="qc-mockups__generation-status">
          {selectedDevices.length > 1
            ? `Creating mockup ${generationProgress} of ${selectedDevices.length}...`
            : 'Creating your mockup...'}
        </p>
        <p className="qc-mockups__generation-style">
          {STYLE_OPTIONS.find(s => s.id === selectedStyle)?.label} style
        </p>
      </div>

      {selectedDevices.length > 1 && (
        <div className="qc-mockups__progress-bar">
          <div
            className="qc-mockups__progress-fill"
            style={{ width: `${(generationProgress / selectedDevices.length) * 100}%` }}
          />
        </div>
      )}
    </div>
  );

  // Render error state
  const renderError = () => (
    <div className="qc-mockups__error-view">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <h2 className="qc-mockups__error-title">Generation Failed</h2>
      <p className="qc-mockups__error-text">{generationError}</p>
      <div className="qc-mockups__error-actions">
        <button type="button" onClick={handleRetry}>Try Again</button>
        <button type="button" className="secondary" onClick={handleStartOver}>Start Over</button>
      </div>
    </div>
  );

  // Render generated mockups
  const renderResults = () => (
    <div className="qc-mockups__result">
      {/* Result header */}
      <div className="qc-mockups__result-header">
        <button
          type="button"
          className="qc-mockups__start-over-btn"
          onClick={handleStartOver}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          Start Over
        </button>
        <div className="qc-mockups__result-stats">
          <span className="qc-mockups__result-count">
            {generatedMockups?.length} mockup{generatedMockups?.length !== 1 ? 's' : ''} generated
          </span>
          <span className="qc-mockups__result-style">
            {STYLE_OPTIONS.find(s => s.id === selectedStyle)?.label} style
          </span>
        </div>
      </div>

      {/* Action bar */}
      <div className="qc-mockups__action-bar">
        <div className="qc-mockups__action-bar-left">
          <span className="qc-mockups__devices-info">
            {generatedMockups?.map(m => m.device).join(', ')}
          </span>
        </div>
        <div className="qc-mockups__action-bar-right">
          <button
            type="button"
            className="qc-mockups__action-btn qc-mockups__action-btn--primary"
            onClick={handleDownloadAll}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download All
          </button>
        </div>
      </div>

      {/* Mockup cards */}
      <div className="qc-mockups__cards">
        {generatedMockups?.map((mockup) => (
          <div key={mockup.id} className="qc-mockups__card">
            <div className="qc-mockups__card-header">
              <div className="qc-mockups__card-device">
                {renderDeviceIcon(mockup.device)}
                <span>{mockup.device.charAt(0).toUpperCase() + mockup.device.slice(1)}</span>
              </div>
              <button
                type="button"
                className="qc-mockups__card-download"
                onClick={() => handleDownload(mockup)}
                aria-label={`Download ${mockup.device} mockup`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </button>
            </div>
            <div className="qc-mockups__card-preview">
              <img
                src={mockup.imageUrl}
                alt={`${mockup.device} mockup - ${mockup.style} style`}
                className="qc-mockups__card-image"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Render input form
  const renderInputForm = () => (
    <>
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
    </>
  );

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
            <h1 className="qc-mockups__title">
              {generatedMockups ? 'Generated Mockups' : 'Design Mockups'}
            </h1>
            <p className="qc-mockups__subtitle">
              {generatedMockups
                ? 'Review and download your generated UI mockups.'
                : 'Generate UI mockups from user stories or feature descriptions using AI.'}
            </p>
          </div>
        </div>

        {/* Conditional Content */}
        {isGenerating && renderGenerating()}
        {generationError && !isGenerating && renderError()}
        {generatedMockups && !isGenerating && renderResults()}
        {!generatedMockups && !isGenerating && !generationError && renderInputForm()}
      </section>
    </main>
  );
}

export default QuickConvertMockupsPage;
