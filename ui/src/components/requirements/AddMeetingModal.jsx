import React, { useState, useRef, useEffect, useCallback } from 'react';
import Modal from '../common/Modal';
import './AddMeetingModal.css';

// Section display labels
const SECTION_LABELS = {
  problems: 'Problems',
  user_goals: 'User Goals',
  functional_requirements: 'Functional Requirements',
  data_needs: 'Data Needs',
  constraints: 'Constraints',
  non_goals: 'Non Goals',
  risks_assumptions: 'Risks & Assumptions',
  open_questions: 'Open Questions',
  action_items: 'Action Items',
};

// Order for displaying sections
const SECTION_ORDER = [
  'problems',
  'user_goals',
  'functional_requirements',
  'data_needs',
  'constraints',
  'non_goals',
  'risks_assumptions',
  'open_questions',
  'action_items',
];

/**
 * Modal for adding meeting notes/transcript to extract requirements.
 * Supports pasting content in a textarea or uploading .txt/.md files.
 * After extraction, displays results with checkboxes for selection.
 *
 * @param {object} props
 * @param {string} props.projectId - Project ID for API call
 * @param {function} props.onClose - Callback to close modal
 * @param {function} [props.onSave] - Callback when requirements are saved (receives saved count)
 */
function AddMeetingModal({ projectId, onClose, onSave }) {
  const [content, setContent] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractError, setExtractError] = useState(null);
  const fileInputRef = useRef(null);

  // Extraction results state
  const [jobId, setJobId] = useState(null);
  const [extractedItems, setExtractedItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [extractionStatus, setExtractionStatus] = useState('idle'); // 'idle' | 'streaming' | 'complete' | 'error'
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

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

  // Start SSE streaming when we have a jobId
  useEffect(() => {
    if (!jobId) return;

    // Track if extraction completed to avoid false error on close
    let completed = false;

    const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:8000');
    const eventSource = new EventSource(`${BASE_URL}/api/meetings/${jobId}/stream`);

    eventSource.addEventListener('status', (e) => {
      const status = JSON.parse(e.data);
      if (status === 'processing') {
        setExtractionStatus('streaming');
      }
    });

    eventSource.addEventListener('item', (e) => {
      const item = JSON.parse(e.data);
      setExtractedItems((prev) => {
        const newItems = [...prev, item];
        // Auto-select new item by index
        setSelectedItems((prevSelected) => new Set([...prevSelected, newItems.length - 1]));
        return newItems;
      });
    });

    eventSource.addEventListener('complete', () => {
      completed = true;
      setExtractionStatus('complete');
      setIsProcessing(false);
      eventSource.close();
    });

    eventSource.addEventListener('error', (e) => {
      // Check if it's a real error or just the connection closing
      if (eventSource.readyState === EventSource.CLOSED) {
        return;
      }
      try {
        const error = JSON.parse(e.data);
        setExtractError(error.message || 'Extraction failed');
      } catch {
        setExtractError('Extraction failed. Please try again.');
      }
      setExtractionStatus('error');
      setIsProcessing(false);
      eventSource.close();
    });

    eventSource.onerror = () => {
      // Only show error if we haven't completed successfully
      if (!completed) {
        setExtractError('Connection lost. Please try again.');
        setExtractionStatus('error');
        setIsProcessing(false);
      }
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [jobId]); // Only depend on jobId - don't reconnect when status changes

  const handleExtract = async () => {
    if (!hasContent || !projectId) return;

    setIsProcessing(true);
    setExtractError(null);
    setExtractedItems([]);
    setSelectedItems(new Set());
    setExtractionStatus('idle');

    try {
      // Create form data for the upload API
      const formData = new FormData();
      formData.append('project_id', projectId);
      formData.append('title', fileName || 'Meeting Notes');
      formData.append('meeting_date', new Date().toISOString().split('T')[0]);
      formData.append('text', content);

      // Call the upload API
      const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:8000');
      const response = await fetch(`${BASE_URL}/api/meetings/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Upload failed with status ${response.status}`);
      }

      const data = await response.json();

      // Set the job ID to start streaming
      setJobId(data.job_id);
    } catch (error) {
      setExtractError(error.message || 'Failed to start extraction. Please try again.');
      setIsProcessing(false);
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

  // Toggle item selection
  const toggleItem = useCallback((index) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  }, []);

  // Toggle all items in a section
  const toggleSection = useCallback((sectionItems) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      const allSelected = sectionItems.every((item) => newSet.has(item.index));
      if (allSelected) {
        // Deselect all in section
        sectionItems.forEach((item) => newSet.delete(item.index));
      } else {
        // Select all in section
        sectionItems.forEach((item) => newSet.add(item.index));
      }
      return newSet;
    });
  }, []);

  // Save selected items to project
  const handleSaveToProject = async () => {
    if (selectedItems.size === 0 || !jobId) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      // We need to get the item IDs first by fetching the meeting
      const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:8000');
      const meetingResponse = await fetch(`${BASE_URL}/api/meetings/${jobId}`);

      if (!meetingResponse.ok) {
        throw new Error('Failed to fetch meeting data');
      }

      const meetingData = await meetingResponse.json();

      // Map extracted items to meeting items by content match
      const decisionsWithIds = [];
      extractedItems.forEach((item, index) => {
        if (selectedItems.has(index)) {
          // Find matching meeting item by content
          const meetingItem = meetingData.items.find(
            (mi) => mi.content === item.content && mi.section === item.section
          );
          if (meetingItem) {
            decisionsWithIds.push({
              item_id: meetingItem.id,
              decision: 'added',
            });
          }
        }
      });

      // Call resolve endpoint
      const response = await fetch(`${BASE_URL}/api/meetings/${jobId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ decisions: decisionsWithIds }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to save requirements');
      }

      const result = await response.json();

      // Notify parent of success
      if (onSave) {
        onSave(result.added);
      }

      // Close modal
      onClose();
    } catch (error) {
      setSaveError(error.message || 'Failed to save requirements. Please try again.');
      setIsSaving(false);
    }
  };

  // Group extracted items by section
  const groupedItems = extractedItems.reduce((acc, item, index) => {
    const section = item.section;
    if (!acc[section]) {
      acc[section] = [];
    }
    acc[section].push({ ...item, index });
    return acc;
  }, {});

  // Get sections in order, only including those with items
  const sectionsWithItems = SECTION_ORDER.filter((section) => groupedItems[section]?.length > 0);

  // Show results view if we have extracted items or are streaming
  const showResults = extractedItems.length > 0 || extractionStatus === 'streaming';

  return (
    <Modal title={showResults ? 'Extracted Requirements' : 'Add Meeting Notes'} onClose={onClose}>
      <div className={`add-meeting-modal ${showResults ? 'add-meeting-modal--results' : ''}`}>
        {showResults ? (
          <>
            {/* Results description */}
            <p className="add-meeting-modal__description">
              {extractionStatus === 'streaming' ? (
                <>Extracting requirements from your meeting notes...</>
              ) : (
                <>
                  Select the requirements you want to add to your project.{' '}
                  <strong>{selectedItems.size}</strong> of <strong>{extractedItems.length}</strong> selected.
                </>
              )}
            </p>

            {/* Streaming indicator */}
            {extractionStatus === 'streaming' && (
              <div className="add-meeting-modal__streaming">
                <span className="add-meeting-modal__spinner" aria-hidden="true" />
                <span>Extracting...</span>
              </div>
            )}

            {/* Results sections */}
            <div className="add-meeting-modal__results">
              {sectionsWithItems.map((section) => {
                const items = groupedItems[section];
                const allSelected = items.every((item) => selectedItems.has(item.index));
                const someSelected = items.some((item) => selectedItems.has(item.index));

                return (
                  <div key={section} className="add-meeting-modal__section">
                    <div className="add-meeting-modal__section-header">
                      <label className="add-meeting-modal__section-checkbox">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={(el) => {
                            if (el) {
                              el.indeterminate = someSelected && !allSelected;
                            }
                          }}
                          onChange={() => toggleSection(items)}
                          disabled={isSaving}
                        />
                        <span className="add-meeting-modal__section-title">
                          {SECTION_LABELS[section] || section}
                        </span>
                        <span className="add-meeting-modal__section-count">
                          ({items.length})
                        </span>
                      </label>
                    </div>
                    <div className="add-meeting-modal__section-items">
                      {items.map((item) => (
                        <label
                          key={item.index}
                          className={`add-meeting-modal__item ${
                            selectedItems.has(item.index) ? 'add-meeting-modal__item--selected' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedItems.has(item.index)}
                            onChange={() => toggleItem(item.index)}
                            disabled={isSaving}
                          />
                          <span className="add-meeting-modal__item-content">
                            {item.content}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Empty state while streaming */}
              {extractionStatus === 'streaming' && extractedItems.length === 0 && (
                <div className="add-meeting-modal__empty-streaming">
                  <span>Waiting for extracted items...</span>
                </div>
              )}
            </div>

            {/* Save error */}
            {saveError && (
              <div className="add-meeting-modal__extract-error" role="alert">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{saveError}</span>
              </div>
            )}

            {/* Results actions */}
            <div className="add-meeting-modal__actions">
              <button
                type="button"
                className="add-meeting-modal__cancel-btn"
                onClick={onClose}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="add-meeting-modal__save-btn"
                onClick={handleSaveToProject}
                disabled={selectedItems.size === 0 || isSaving || extractionStatus === 'streaming'}
              >
                {isSaving ? (
                  <>
                    <span className="add-meeting-modal__spinner" aria-hidden="true" />
                    Saving...
                  </>
                ) : (
                  `Add to Project (${selectedItems.size})`
                )}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Input form view */}
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
                  if (extractError) setExtractError(null);
                }}
                rows={10}
                disabled={isProcessing}
              />
            </div>

            <div className="add-meeting-modal__divider">
              <span>or</span>
            </div>

            <div
              className={`add-meeting-modal__upload-zone ${dragActive ? 'add-meeting-modal__upload-zone--active' : ''} ${isProcessing ? 'add-meeting-modal__upload-zone--disabled' : ''}`}
              onDragEnter={isProcessing ? undefined : handleDrag}
              onDragOver={isProcessing ? undefined : handleDrag}
              onDragLeave={isProcessing ? undefined : handleDrag}
              onDrop={isProcessing ? undefined : handleDrop}
              onClick={isProcessing ? undefined : handleUploadClick}
              role="button"
              tabIndex={isProcessing ? -1 : 0}
              onKeyDown={(e) => {
                if (!isProcessing && (e.key === 'Enter' || e.key === ' ')) {
                  handleUploadClick();
                }
              }}
              aria-disabled={isProcessing}
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
                  disabled={isProcessing}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            )}

            {extractError && (
              <div className="add-meeting-modal__extract-error" role="alert">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{extractError}</span>
              </div>
            )}

            <div className="add-meeting-modal__actions">
              <button
                type="button"
                className="add-meeting-modal__cancel-btn"
                onClick={onClose}
                disabled={isProcessing}
              >
                Cancel
              </button>
              <button
                type="button"
                className="add-meeting-modal__extract-btn"
                onClick={handleExtract}
                disabled={!hasContent || isProcessing}
              >
                {isProcessing ? (
                  <>
                    <span className="add-meeting-modal__spinner" aria-hidden="true" />
                    Processing...
                  </>
                ) : (
                  'Extract Requirements'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export default AddMeetingModal;
