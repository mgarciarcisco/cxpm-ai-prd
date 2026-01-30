import React, { useState, useRef, useEffect, useCallback } from 'react';
import './MeetingComponents.css';

/**
 * Generate a unique ID for a new meeting
 * @returns {string} - A unique meeting ID
 */
const generateMeetingId = () => {
  return `meeting-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

// Supported file types (module-level for stable references)
const ACCEPTED_FILE_TYPES = ['.txt', '.md'];
const ACCEPTED_MIME_TYPES = ['text/plain', 'text/markdown'];

const isValidFileType = (file) => {
  const extension = '.' + file.name.split('.').pop().toLowerCase();
  return ACCEPTED_FILE_TYPES.includes(extension) || ACCEPTED_MIME_TYPES.includes(file.type);
};

/**
 * AddMeetingModal for the requirements extraction redesign.
 * Allows users to add a new meeting with name, date, transcript, and notes.
 * Supports both text input and file upload for transcripts.
 *
 * @param {object} props
 * @param {boolean} props.isOpen - Whether the modal is visible
 * @param {function} props.onClose - Callback to close the modal
 * @param {function} props.onAdd - Callback when a meeting is added (receives meeting object)
 */
function QuickConvertAddMeetingModal({ isOpen, onClose, onAdd }) {
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [transcript, setTranscript] = useState('');
  const [notes, setNotes] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState(null);
  const [fileError, setFileError] = useState(null);

  const fileInputRef = useRef(null);
  const modalRef = useRef(null);
  const previousActiveElement = useRef(null);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setName('');
      setDate('');
      setTranscript('');
      setNotes('');
      setFileName(null);
      setFileError(null);
    }
  }, [isOpen]);

  // Handle ESC key and focus trap
  useEffect(() => {
    if (!isOpen) return;

    previousActiveElement.current = document.activeElement;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }

      // Focus trap
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstFocusable) {
            e.preventDefault();
            lastFocusable?.focus();
          }
        } else {
          if (document.activeElement === lastFocusable) {
            e.preventDefault();
            firstFocusable?.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    // Focus first input
    if (modalRef.current) {
      const firstInput = modalRef.current.querySelector('input, textarea');
      if (firstInput) {
        firstInput.focus();
      }
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [isOpen, onClose]);

  const handleFileRead = useCallback((file) => {
    if (!isValidFileType(file)) {
      setFileError('Invalid file type. Please upload a .txt or .md file.');
      return;
    }

    setFileError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      setTranscript(e.target.result);
      setFileName(file.name);
    };
    reader.onerror = () => {
      setFileError('Failed to read file. Please try again.');
    };
    reader.readAsText(file);
  }, []);

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

  const handleClearFile = (e) => {
    e.stopPropagation();
    setFileName(null);
    setTranscript('');
    setFileError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validate required fields
    if (!name.trim()) {
      return;
    }

    // Create meeting object
    const meeting = {
      id: generateMeetingId(),
      name: name.trim(),
      date: date || null,
      transcript: transcript.trim(),
      notes: notes.trim(),
    };

    onAdd(meeting);
    onClose();
  };

  const isFormValid = name.trim().length > 0;

  if (!isOpen) return null;

  return (
    <div
      className="add-meeting-modal-overlay"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        className="add-meeting-modal"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-meeting-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="add-meeting-modal__header">
          <h2 id="add-meeting-modal-title" className="add-meeting-modal__title">
            Add Meeting
          </h2>
          <button
            type="button"
            className="add-meeting-modal__close"
            onClick={onClose}
            aria-label="Close modal"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="add-meeting-modal__body">
            {/* Name and Date Row */}
            <div className="add-meeting-modal__form-row">
              <div className="add-meeting-modal__form-group">
                <label htmlFor="meeting-name" className="add-meeting-modal__label">
                  Meeting Name
                </label>
                <input
                  type="text"
                  id="meeting-name"
                  className="add-meeting-modal__input"
                  placeholder="e.g., Sprint Planning - Jan 15"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="add-meeting-modal__form-group">
                <label htmlFor="meeting-date" className="add-meeting-modal__label">
                  Date <span className="add-meeting-modal__label-optional">(optional)</span>
                </label>
                <input
                  type="date"
                  id="meeting-date"
                  className="add-meeting-modal__input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>

            {/* Transcript */}
            <div className="add-meeting-modal__form-group">
              <label htmlFor="meeting-transcript" className="add-meeting-modal__label">
                Transcript
              </label>
              <textarea
                id="meeting-transcript"
                className="add-meeting-modal__textarea"
                placeholder="Paste your meeting transcript here..."
                value={transcript}
                onChange={(e) => {
                  setTranscript(e.target.value);
                  if (fileName) setFileName(null);
                }}
                rows={6}
              />
              <div className="add-meeting-modal__hint">Or upload a file:</div>
              <div
                className={`add-meeting-modal__upload-zone ${dragActive ? 'add-meeting-modal__upload-zone--active' : ''} ${fileName ? 'add-meeting-modal__upload-zone--has-file' : ''}`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={handleUploadClick}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleUploadClick();
                  }
                }}
                aria-label="Upload transcript file"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,text/plain,text/markdown"
                  onChange={handleFileChange}
                  className="add-meeting-modal__file-input"
                  aria-hidden="true"
                />
                <div className="add-meeting-modal__upload-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <div className="add-meeting-modal__upload-text">
                  {dragActive ? 'Drop file here' : 'Click or drag file here'}
                </div>
                <div className="add-meeting-modal__upload-hint">
                  Supports .txt and .md files
                </div>
              </div>

              {fileError && (
                <div className="add-meeting-modal__error" role="alert">
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
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
            </div>

            {/* Notes */}
            <div className="add-meeting-modal__form-group">
              <label htmlFor="meeting-notes" className="add-meeting-modal__label">
                Your Notes <span className="add-meeting-modal__label-optional">(optional)</span>
              </label>
              <textarea
                id="meeting-notes"
                className="add-meeting-modal__textarea"
                placeholder="Add any additional context or notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                style={{ minHeight: '80px' }}
              />
            </div>
          </div>

          <div className="add-meeting-modal__footer">
            <button
              type="button"
              className="add-meeting-modal__btn add-meeting-modal__btn--secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="add-meeting-modal__btn add-meeting-modal__btn--primary"
              disabled={!isFormValid}
            >
              Add Meeting
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default QuickConvertAddMeetingModal;
