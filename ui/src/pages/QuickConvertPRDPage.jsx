import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import './QuickConvertPRDPage.css';

// Input source options
const INPUT_SOURCES = {
  requirements: { id: 'requirements', label: 'Requirements', placeholder: 'Paste your requirements here...' },
  notes: { id: 'notes', label: 'Notes/Description', placeholder: 'Paste meeting notes, feature description, or any text to convert into a PRD...' },
};

// PRD type options
const PRD_TYPES = {
  detailed: { id: 'detailed', label: 'Detailed', description: 'Comprehensive PRD with all sections' },
  brief: { id: 'brief', label: 'Brief', description: 'Concise PRD with key sections only' },
};

/**
 * Quick Convert PRD page - input UI for generating PRDs.
 * Allows users to paste content or upload a file, then generate a PRD.
 */
function QuickConvertPRDPage() {
  const [content, setContent] = useState('');
  const [inputSource, setInputSource] = useState('requirements');
  const [prdType, setPrdType] = useState('detailed');
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

  const handleGenerate = () => {
    if (!hasContent) return;
    // TODO: Implement PRD generation in P4-003b
    console.log('Generate PRD:', { content, inputSource, prdType });
  };

  return (
    <main className="main-content">
      <section className="qc-prd">
        {/* Back Link */}
        <Link to="/quick-convert" className="qc-prd__back-link">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to Quick Convert
        </Link>

        {/* Header */}
        <div className="qc-prd__header">
          <div className="qc-prd__icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 13H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M16 17H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M10 9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="qc-prd__header-content">
            <h1 className="qc-prd__title">Generate PRD</h1>
            <p className="qc-prd__subtitle">
              Transform requirements or notes into a comprehensive Product Requirements Document.
            </p>
          </div>
        </div>

        {/* Input Source Toggle */}
        <div className="qc-prd__input-section">
          <div className="qc-prd__toggle-group">
            <span className="qc-prd__toggle-label">Input Source</span>
            <div className="qc-prd__toggle-buttons">
              {Object.values(INPUT_SOURCES).map((source) => (
                <button
                  key={source.id}
                  type="button"
                  className={`qc-prd__toggle-btn ${inputSource === source.id ? 'qc-prd__toggle-btn--active' : ''}`}
                  onClick={() => setInputSource(source.id)}
                >
                  {source.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content Area */}
          <div className="qc-prd__content-area">
            <label htmlFor="prd-content" className="qc-prd__label">
              {INPUT_SOURCES[inputSource].label}
            </label>
            <textarea
              id="prd-content"
              className="qc-prd__textarea"
              placeholder={INPUT_SOURCES[inputSource].placeholder}
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                if (fileName) setFileName(null);
              }}
              rows={12}
            />
          </div>

          <div className="qc-prd__divider">
            <span>or</span>
          </div>

          {/* File Upload Zone */}
          <div
            className={`qc-prd__upload-zone ${dragActive ? 'qc-prd__upload-zone--active' : ''}`}
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
              className="qc-prd__file-input"
              aria-label="Upload file"
            />
            <svg
              className="qc-prd__upload-icon"
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
            <span className="qc-prd__upload-text">
              {dragActive ? 'Drop file here' : 'Click or drag file here'}
            </span>
            <span className="qc-prd__upload-hint">
              Supports .txt and .md files
            </span>
          </div>

          {fileError && (
            <div className="qc-prd__error" role="alert">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{fileError}</span>
            </div>
          )}

          {fileName && (
            <div className="qc-prd__file-info">
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
              <span className="qc-prd__file-name">{fileName}</span>
              <button
                type="button"
                className="qc-prd__file-clear"
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

        {/* PRD Type Toggle */}
        <div className="qc-prd__options-section">
          <div className="qc-prd__toggle-group">
            <span className="qc-prd__toggle-label">PRD Type</span>
            <div className="qc-prd__type-options">
              {Object.values(PRD_TYPES).map((type) => (
                <label key={type.id} className="qc-prd__type-option">
                  <input
                    type="radio"
                    name="prd-type"
                    value={type.id}
                    checked={prdType === type.id}
                    onChange={(e) => setPrdType(e.target.value)}
                    className="qc-prd__type-radio"
                  />
                  <div className="qc-prd__type-content">
                    <span className="qc-prd__type-label">{type.label}</span>
                    <span className="qc-prd__type-description">{type.description}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="qc-prd__actions">
          <button
            type="button"
            className="qc-prd__generate-btn"
            onClick={handleGenerate}
            disabled={!hasContent}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 13H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M16 17H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M10 9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Generate PRD
          </button>
        </div>
      </section>
    </main>
  );
}

export default QuickConvertPRDPage;
