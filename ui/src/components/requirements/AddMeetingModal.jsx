import React, { useState, useRef } from 'react';
import Modal from '../common/Modal';
import './AddMeetingModal.css';

/**
 * Modal for adding meeting notes/transcript to extract requirements.
 * Supports pasting content in a textarea or uploading .txt/.md files.
 *
 * @param {object} props
 * @param {function} props.onClose - Callback to close modal
 * @param {function} [props.onExtract] - Callback when Extract Requirements is clicked (receives content string)
 */
function AddMeetingModal({ onClose, onExtract }) {
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
      setFileError(`Invalid file type. Please upload a .txt or .md file.`);
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

  const handleExtract = () => {
    if (hasContent && onExtract) {
      onExtract(content);
    }
  };

  const handleClearFile = () => {
    setFileName(null);
    setContent('');
    setFileError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Modal title="Add Meeting Notes" onClose={onClose}>
      <div className="add-meeting-modal">
        <p className="add-meeting-modal__description">
          Paste meeting notes or transcript below, or upload a file to extract requirements.
        </p>

        <div className="add-meeting-modal__content-area">
          <label htmlFor="meeting-content" className="add-meeting-modal__label">
            Meeting Content
          </label>
          <textarea
            id="meeting-content"
            className="add-meeting-modal__textarea"
            placeholder="Paste your meeting notes, transcript, or any text containing project requirements..."
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              if (fileName) setFileName(null);
            }}
            rows={10}
          />
        </div>

        <div className="add-meeting-modal__divider">
          <span>or</span>
        </div>

        <div
          className={`add-meeting-modal__upload-zone ${dragActive ? 'add-meeting-modal__upload-zone--active' : ''}`}
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
            className="add-meeting-modal__file-input"
            aria-label="Upload file"
          />
          <svg
            className="add-meeting-modal__upload-icon"
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
          <span className="add-meeting-modal__upload-text">
            {dragActive ? 'Drop file here' : 'Click or drag file here'}
          </span>
          <span className="add-meeting-modal__upload-hint">
            Supports .txt and .md files
          </span>
        </div>

        {fileError && (
          <div className="add-meeting-modal__file-error" role="alert">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{fileError}</span>
          </div>
        )}

        {fileName && (
          <div className="add-meeting-modal__file-info">
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
            <span className="add-meeting-modal__file-name">{fileName}</span>
            <button
              type="button"
              className="add-meeting-modal__file-clear"
              onClick={handleClearFile}
              aria-label="Clear file"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        <div className="add-meeting-modal__actions">
          <button
            type="button"
            className="add-meeting-modal__cancel-btn"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="add-meeting-modal__extract-btn"
            onClick={handleExtract}
            disabled={!hasContent}
          >
            Extract Requirements
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default AddMeetingModal;
