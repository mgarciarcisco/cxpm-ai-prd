import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import './QuickConvertRequirementsPage.css';

/**
 * Quick Convert Requirements page - input UI for extracting requirements.
 * Allows users to paste content or upload a file, then extract requirements.
 */
function QuickConvertRequirementsPage() {
  const [content, setContent] = useState('');
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

  const handleExtract = () => {
    // TODO: Implement extraction in P4-002b
    console.log('Extract requirements from:', content.substring(0, 100));
  };

  return (
    <main className="main-content">
      <section className="qc-requirements">
        {/* Back Link */}
        <Link to="/quick-convert" className="qc-requirements__back-link">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to Quick Convert
        </Link>

        {/* Header */}
        <div className="qc-requirements__header">
          <div className="qc-requirements__icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5C15 6.10457 14.1046 7 13 7H11C9.89543 7 9 6.10457 9 5Z" stroke="currentColor" strokeWidth="2"/>
              <path d="M9 12H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M9 16H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="qc-requirements__header-content">
            <h1 className="qc-requirements__title">Extract Requirements</h1>
            <p className="qc-requirements__subtitle">
              Paste meeting notes, transcript, or any document to extract structured requirements.
            </p>
          </div>
        </div>

        {/* Input Area */}
        <div className="qc-requirements__input-section">
          <div className="qc-requirements__content-area">
            <label htmlFor="requirements-content" className="qc-requirements__label">
              Meeting Notes or Document
            </label>
            <textarea
              id="requirements-content"
              className="qc-requirements__textarea"
              placeholder="Paste your meeting notes, transcript, or any text containing project requirements..."
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                if (fileName) setFileName(null);
              }}
              rows={12}
            />
          </div>

          <div className="qc-requirements__divider">
            <span>or</span>
          </div>

          <div
            className={`qc-requirements__upload-zone ${dragActive ? 'qc-requirements__upload-zone--active' : ''}`}
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
              className="qc-requirements__file-input"
              aria-label="Upload file"
            />
            <svg
              className="qc-requirements__upload-icon"
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
            <span className="qc-requirements__upload-text">
              {dragActive ? 'Drop file here' : 'Click or drag file here'}
            </span>
            <span className="qc-requirements__upload-hint">
              Supports .txt and .md files
            </span>
          </div>

          {fileError && (
            <div className="qc-requirements__error" role="alert">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{fileError}</span>
            </div>
          )}

          {fileName && (
            <div className="qc-requirements__file-info">
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
              <span className="qc-requirements__file-name">{fileName}</span>
              <button
                type="button"
                className="qc-requirements__file-clear"
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

        {/* Action Button */}
        <div className="qc-requirements__actions">
          <button
            type="button"
            className="qc-requirements__extract-btn"
            onClick={handleExtract}
            disabled={!hasContent}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5C15 6.10457 14.1046 7 13 7H11C9.89543 7 9 6.10457 9 5Z" stroke="currentColor" strokeWidth="2"/>
              <path d="M9 12H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M9 16H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Extract Requirements
          </button>
        </div>
      </section>
    </main>
  );
}

export default QuickConvertRequirementsPage;
