import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import './QuickConvertStoriesPage.css';

// Input source options
const INPUT_SOURCES = {
  prd: { id: 'prd', label: 'PRD', placeholder: 'Paste your Product Requirements Document here...' },
  description: { id: 'description', label: 'Feature Description', placeholder: 'Describe the feature or functionality you want to create user stories for...' },
};

// Story format options
const STORY_FORMATS = {
  standard: { id: 'standard', label: 'Standard', description: 'As a [user], I want [goal] so that [benefit]' },
  gherkin: { id: 'gherkin', label: 'Gherkin', description: 'Given/When/Then format for BDD' },
  jtbd: { id: 'jtbd', label: 'Jobs to be Done', description: 'When [situation], I want to [motivation], so I can [outcome]' },
};

// Include options
const INCLUDE_OPTIONS = {
  acceptanceCriteria: { id: 'acceptanceCriteria', label: 'Acceptance Criteria', description: 'Detailed conditions for story completion' },
  size: { id: 'size', label: 'Size Estimates', description: 'T-shirt sizing (XS, S, M, L, XL)' },
  priority: { id: 'priority', label: 'Priority', description: 'P1, P2, P3 priority levels' },
};

/**
 * Quick Convert Stories page - input UI for generating user stories.
 * Allows users to paste a PRD or feature description, then generate user stories.
 */
function QuickConvertStoriesPage() {
  const [content, setContent] = useState('');
  const [inputSource, setInputSource] = useState('prd');
  const [storyFormat, setStoryFormat] = useState('standard');
  const [includeOptions, setIncludeOptions] = useState({
    acceptanceCriteria: true,
    size: false,
    priority: false,
  });
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState(null);
  const [fileError, setFileError] = useState(null);
  const fileInputRef = useRef(null);

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

  const handleIncludeOptionChange = (optionId) => {
    setIncludeOptions((prev) => ({
      ...prev,
      [optionId]: !prev[optionId],
    }));
  };

  const handleGenerate = () => {
    if (!hasContent) return;

    // TODO: Will be implemented in P4-004b
    console.log('Generating stories with:', {
      content,
      inputSource,
      storyFormat,
      includeOptions,
    });
  };

  return (
    <main className="main-content">
      <section className="qc-stories">
        {/* Back Link */}
        <Link to="/quick-convert" className="qc-stories__back-link">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to Quick Convert
        </Link>

        {/* Header */}
        <div className="qc-stories__header">
          <div className="qc-stories__icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
              <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
              <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
              <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </div>
          <div className="qc-stories__header-content">
            <h1 className="qc-stories__title">Create User Stories</h1>
            <p className="qc-stories__subtitle">
              Generate user stories from a PRD or feature description, complete with acceptance criteria.
            </p>
          </div>
        </div>

        {/* Input Section */}
        <div className="qc-stories__input-section">
          {/* Input Source Toggle */}
          <div className="qc-stories__toggle-group">
            <span className="qc-stories__toggle-label">Input Source</span>
            <div className="qc-stories__toggle-buttons">
              {Object.values(INPUT_SOURCES).map((source) => (
                <button
                  key={source.id}
                  type="button"
                  className={`qc-stories__toggle-btn ${inputSource === source.id ? 'qc-stories__toggle-btn--active' : ''}`}
                  onClick={() => setInputSource(source.id)}
                >
                  {source.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content Area */}
          <div className="qc-stories__content-area">
            <label htmlFor="stories-content" className="qc-stories__label">
              {INPUT_SOURCES[inputSource].label}
            </label>
            <textarea
              id="stories-content"
              className="qc-stories__textarea"
              placeholder={INPUT_SOURCES[inputSource].placeholder}
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                if (fileName) setFileName(null);
              }}
              rows={12}
            />
          </div>

          <div className="qc-stories__divider">
            <span>or</span>
          </div>

          {/* File Upload Zone */}
          <div
            className={`qc-stories__upload-zone ${dragActive ? 'qc-stories__upload-zone--active' : ''}`}
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
              className="qc-stories__file-input"
              aria-label="Upload file"
            />
            <svg
              className="qc-stories__upload-icon"
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
            <span className="qc-stories__upload-text">
              {dragActive ? 'Drop file here' : 'Click or drag file here'}
            </span>
            <span className="qc-stories__upload-hint">
              Supports .txt and .md files
            </span>
          </div>

          {fileError && (
            <div className="qc-stories__error" role="alert">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{fileError}</span>
            </div>
          )}

          {fileName && (
            <div className="qc-stories__file-info">
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
              <span className="qc-stories__file-name">{fileName}</span>
              <button
                type="button"
                className="qc-stories__file-clear"
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
        <div className="qc-stories__options-section">
          {/* Story Format Selection */}
          <div className="qc-stories__toggle-group">
            <span className="qc-stories__toggle-label">Story Format</span>
            <div className="qc-stories__format-options">
              {Object.values(STORY_FORMATS).map((format) => (
                <label key={format.id} className="qc-stories__format-option">
                  <input
                    type="radio"
                    name="story-format"
                    value={format.id}
                    checked={storyFormat === format.id}
                    onChange={(e) => setStoryFormat(e.target.value)}
                    className="qc-stories__format-radio"
                  />
                  <div className="qc-stories__format-content">
                    <span className="qc-stories__format-label">{format.label}</span>
                    <span className="qc-stories__format-description">{format.description}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Include Options */}
          <div className="qc-stories__toggle-group qc-stories__toggle-group--include">
            <span className="qc-stories__toggle-label">Include</span>
            <div className="qc-stories__include-options">
              {Object.values(INCLUDE_OPTIONS).map((option) => (
                <label key={option.id} className="qc-stories__include-option">
                  <input
                    type="checkbox"
                    checked={includeOptions[option.id]}
                    onChange={() => handleIncludeOptionChange(option.id)}
                    className="qc-stories__include-checkbox"
                  />
                  <div className="qc-stories__include-content">
                    <span className="qc-stories__include-label">{option.label}</span>
                    <span className="qc-stories__include-description">{option.description}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="qc-stories__actions">
          <button
            type="button"
            className="qc-stories__generate-btn"
            onClick={handleGenerate}
            disabled={!hasContent}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
              <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
              <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
              <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
            </svg>
            Generate Stories
          </button>
        </div>
      </section>
    </main>
  );
}

export default QuickConvertStoriesPage;
