import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SaveToProjectModal from '../components/quick-convert/SaveToProjectModal';
import { STORAGE_KEYS, saveToSession, loadFromSession, clearSession } from '../utils/sessionStorage';
import './QuickConvertRequirementsPage.css';

// Section metadata with display names
const SECTION_CONFIG = {
  problems: { label: 'Problems', icon: '⚠️' },
  user_goals: { label: 'User Goals', icon: '🎯' },
  functional_requirements: { label: 'Functional Requirements', icon: '⚙️' },
  data_needs: { label: 'Data Needs', icon: '📊' },
  constraints: { label: 'Constraints', icon: '🔒' },
  non_goals: { label: 'Non-Goals', icon: '🚫' },
  risks_assumptions: { label: 'Risks & Assumptions', icon: '⚡' },
  open_questions: { label: 'Open Questions', icon: '❓' },
  action_items: { label: 'Action Items', icon: '✅' },
};

// Section order for display
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
 * Quick Convert Requirements page - input UI for extracting requirements.
 * Allows users to paste content or upload a file, then extract requirements.
 */
function QuickConvertRequirementsPage() {
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState(null);
  const [fileError, setFileError] = useState(null);
  const fileInputRef = useRef(null);

  // Extraction state
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState(null);
  const [extractedItems, setExtractedItems] = useState(null); // { section: [{ id, content, selected }] }
  const [editingItem, setEditingItem] = useState(null); // { section, id }
  const [editValue, setEditValue] = useState('');

  // Modal state
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Session storage state
  const [restoredFromSession, setRestoredFromSession] = useState(false);

  // Restore data from session storage on mount
  useEffect(() => {
    const stored = loadFromSession(STORAGE_KEYS.REQUIREMENTS);
    if (stored?.data?.extractedItems) {
      setExtractedItems(stored.data.extractedItems);
      setRestoredFromSession(true);
    }
  }, []);

  // Save to session storage when extracted items change
  useEffect(() => {
    if (extractedItems) {
      saveToSession(STORAGE_KEYS.REQUIREMENTS, { extractedItems });
    }
  }, [extractedItems]);

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

  // Simulated extraction - in production this would call the backend API
  const simulateExtraction = useCallback(async (text) => {
    // Simulate API latency
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Simple keyword-based extraction simulation
    const lines = text.split('\n').filter(line => line.trim());
    const items = {};

    // Initialize sections
    SECTION_ORDER.forEach(section => {
      items[section] = [];
    });

    let idCounter = 1;

    // Simple pattern matching to categorize content
    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine.length < 10) return; // Skip very short lines

      // Remove common list markers
      const cleanedLine = trimmedLine
        .replace(/^[-*•]\s*/, '')
        .replace(/^\d+[.)]\s*/, '')
        .trim();

      if (!cleanedLine) return;

      const lowerLine = cleanedLine.toLowerCase();
      let section = 'functional_requirements'; // Default

      // Categorize based on keywords
      if (lowerLine.includes('problem') || lowerLine.includes('issue') || lowerLine.includes('pain point') || lowerLine.includes('challenge')) {
        section = 'problems';
      } else if (lowerLine.includes('goal') || lowerLine.includes('want') || lowerLine.includes('need to') || lowerLine.includes('user should')) {
        section = 'user_goals';
      } else if (lowerLine.includes('data') || lowerLine.includes('store') || lowerLine.includes('database') || lowerLine.includes('field')) {
        section = 'data_needs';
      } else if (lowerLine.includes('constraint') || lowerLine.includes('must not') || lowerLine.includes('limitation') || lowerLine.includes('restrict')) {
        section = 'constraints';
      } else if (lowerLine.includes('not') && (lowerLine.includes('scope') || lowerLine.includes('goal') || lowerLine.includes('include'))) {
        section = 'non_goals';
      } else if (lowerLine.includes('risk') || lowerLine.includes('assume') || lowerLine.includes('assumption')) {
        section = 'risks_assumptions';
      } else if (lowerLine.includes('question') || lowerLine.includes('unclear') || lowerLine.includes('?') || lowerLine.includes('tbd')) {
        section = 'open_questions';
      } else if (lowerLine.includes('action') || lowerLine.includes('todo') || lowerLine.includes('follow up') || lowerLine.includes('next step')) {
        section = 'action_items';
      }

      items[section].push({
        id: `item-${idCounter++}`,
        content: cleanedLine,
        selected: true,
      });
    });

    // Filter out empty sections
    const filteredItems = {};
    SECTION_ORDER.forEach(section => {
      if (items[section].length > 0) {
        filteredItems[section] = items[section];
      }
    });

    // If nothing was extracted, create a sample item
    if (Object.keys(filteredItems).length === 0) {
      filteredItems.functional_requirements = [{
        id: 'item-1',
        content: 'No specific requirements could be extracted. Please review your input text.',
        selected: true,
      }];
    }

    return filteredItems;
  }, []);

  const handleExtract = async () => {
    if (!hasContent) return;

    setIsExtracting(true);
    setExtractionError(null);
    setExtractedItems(null);

    try {
      const items = await simulateExtraction(content);
      setExtractedItems(items);
    } catch (error) {
      setExtractionError(error.message || 'Extraction failed. Please try again.');
    } finally {
      setIsExtracting(false);
    }
  };

  // Toggle item selection
  const handleToggleItem = (section, itemId) => {
    setExtractedItems(prev => ({
      ...prev,
      [section]: prev[section].map(item =>
        item.id === itemId ? { ...item, selected: !item.selected } : item
      ),
    }));
  };

  // Toggle all items in a section
  const handleToggleSection = (section) => {
    setExtractedItems(prev => {
      const allSelected = prev[section].every(item => item.selected);
      return {
        ...prev,
        [section]: prev[section].map(item => ({ ...item, selected: !allSelected })),
      };
    });
  };

  // Start editing an item
  const handleStartEdit = (section, itemId, currentContent) => {
    setEditingItem({ section, id: itemId });
    setEditValue(currentContent);
  };

  // Save edited item
  const handleSaveEdit = () => {
    if (!editingItem) return;

    setExtractedItems(prev => ({
      ...prev,
      [editingItem.section]: prev[editingItem.section].map(item =>
        item.id === editingItem.id ? { ...item, content: editValue } : item
      ),
    }));
    setEditingItem(null);
    setEditValue('');
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingItem(null);
    setEditValue('');
  };

  // Delete an item
  const handleDeleteItem = (section, itemId) => {
    setExtractedItems(prev => {
      const updatedSection = prev[section].filter(item => item.id !== itemId);
      if (updatedSection.length === 0) {
        // eslint-disable-next-line no-unused-vars
        const { [section]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [section]: updatedSection };
    });
  };

  // Start over - clear results and session storage
  const handleStartOver = () => {
    setExtractedItems(null);
    setContent('');
    setFileName(null);
    setRestoredFromSession(false);
    clearSession(STORAGE_KEYS.REQUIREMENTS);
  };

  // Get count of selected items
  const getSelectedCount = () => {
    if (!extractedItems) return 0;
    return Object.values(extractedItems).reduce(
      (total, items) => total + items.filter(item => item.selected).length,
      0
    );
  };

  // Get total item count
  const getTotalCount = () => {
    if (!extractedItems) return 0;
    return Object.values(extractedItems).reduce(
      (total, items) => total + items.length,
      0
    );
  };

  // Get selected items for export
  const getSelectedItems = useCallback(() => {
    if (!extractedItems) return {};
    const selected = {};
    for (const [section, items] of Object.entries(extractedItems)) {
      const selectedInSection = items.filter(item => item.selected);
      if (selectedInSection.length > 0) {
        selected[section] = selectedInSection;
      }
    }
    return selected;
  }, [extractedItems]);

  // Navigate to Generate PRD with requirements data
  const handleGeneratePRD = () => {
    const selectedItems = getSelectedItems();
    // Convert selected items to a text format for PRD generation
    const requirementsText = Object.entries(selectedItems)
      .map(([section, items]) => {
        const sectionLabel = SECTION_CONFIG[section]?.label || section;
        const itemsText = items.map(item => `- ${item.content}`).join('\n');
        return `## ${sectionLabel}\n${itemsText}`;
      })
      .join('\n\n');

    navigate('/quick-convert/prd', {
      state: {
        requirements: selectedItems,
        requirementsText,
        source: 'requirements-extraction',
      },
    });
  };

  // Download as JSON
  const handleDownloadJSON = () => {
    const selectedItems = getSelectedItems();
    const dataStr = JSON.stringify(selectedItems, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'requirements.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Download as Markdown
  const handleDownloadMarkdown = () => {
    const selectedItems = getSelectedItems();
    const markdown = Object.entries(selectedItems)
      .map(([section, items]) => {
        const sectionLabel = SECTION_CONFIG[section]?.label || section;
        const itemsText = items.map(item => `- ${item.content}`).join('\n');
        return `## ${sectionLabel}\n\n${itemsText}`;
      })
      .join('\n\n');

    const blob = new Blob([`# Extracted Requirements\n\n${markdown}`], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'requirements.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Render the input form (when no results yet)
  const renderInputForm = () => (
    <>
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
    </>
  );

  // Render processing spinner
  const renderProcessing = () => (
    <div className="qc-requirements__processing">
      <div className="qc-requirements__spinner" />
      <h2 className="qc-requirements__processing-title">Extracting Requirements</h2>
      <p className="qc-requirements__processing-text">
        Analyzing your document and categorizing requirements...
      </p>
    </div>
  );

  // Render extraction error
  const renderError = () => (
    <div className="qc-requirements__extraction-error">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <h2 className="qc-requirements__error-title">Extraction Failed</h2>
      <p className="qc-requirements__error-text">{extractionError}</p>
      <button
        type="button"
        className="qc-requirements__retry-btn"
        onClick={handleExtract}
      >
        Try Again
      </button>
    </div>
  );

  // Render results
  const renderResults = () => {
    const sections = Object.keys(extractedItems);

    return (
      <div className="qc-requirements__results">
        {/* Results Summary */}
        <div className="qc-requirements__results-summary">
          <div className="qc-requirements__results-info">
            <span className="qc-requirements__results-count">
              {getSelectedCount()} of {getTotalCount()} items selected
            </span>
            {restoredFromSession && (
              <span className="qc-requirements__restored-indicator">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
                Restored from previous session
              </span>
            )}
          </div>
          <button
            type="button"
            className="qc-requirements__start-over-btn"
            onClick={handleStartOver}
          >
            Start Over
          </button>
        </div>

        {/* Sections */}
        {SECTION_ORDER.filter(section => sections.includes(section)).map(section => {
          const config = SECTION_CONFIG[section];
          const items = extractedItems[section];
          const allSelected = items.every(item => item.selected);
          const someSelected = items.some(item => item.selected);

          return (
            <div key={section} className="qc-requirements__section">
              <div className="qc-requirements__section-header">
                <label className="qc-requirements__section-checkbox-wrapper">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={el => {
                      if (el) el.indeterminate = someSelected && !allSelected;
                    }}
                    onChange={() => handleToggleSection(section)}
                    className="qc-requirements__section-checkbox"
                  />
                  <span className="qc-requirements__section-icon">{config.icon}</span>
                  <span className="qc-requirements__section-label">{config.label}</span>
                  <span className="qc-requirements__section-count">({items.length})</span>
                </label>
              </div>

              <div className="qc-requirements__items">
                {items.map(item => {
                  const isEditing = editingItem?.section === section && editingItem?.id === item.id;

                  return (
                    <div
                      key={item.id}
                      className={`qc-requirements__item ${item.selected ? '' : 'qc-requirements__item--deselected'} ${isEditing ? 'qc-requirements__item--editing' : ''}`}
                    >
                      {isEditing ? (
                        <div className="qc-requirements__item-edit">
                          <textarea
                            className="qc-requirements__item-edit-input"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            rows={3}
                            autoFocus
                          />
                          <div className="qc-requirements__item-edit-actions">
                            <button
                              type="button"
                              className="qc-requirements__item-save-btn"
                              onClick={handleSaveEdit}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className="qc-requirements__item-cancel-btn"
                              onClick={handleCancelEdit}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <label className="qc-requirements__item-checkbox-wrapper">
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={() => handleToggleItem(section, item.id)}
                              className="qc-requirements__item-checkbox"
                            />
                            <span className="qc-requirements__item-content">{item.content}</span>
                          </label>
                          <div className="qc-requirements__item-actions">
                            <button
                              type="button"
                              className="qc-requirements__item-edit-btn"
                              onClick={() => handleStartEdit(section, item.id, item.content)}
                              aria-label="Edit item"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              className="qc-requirements__item-delete-btn"
                              onClick={() => handleDeleteItem(section, item.id)}
                              aria-label="Delete item"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Action Buttons */}
        <div className="qc-requirements__action-buttons">
          <button
            type="button"
            className="qc-requirements__action-btn qc-requirements__action-btn--primary"
            onClick={() => setShowSaveModal(true)}
            disabled={getSelectedCount() === 0}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            Save to Project
          </button>
          <button
            type="button"
            className="qc-requirements__action-btn qc-requirements__action-btn--secondary"
            onClick={handleGeneratePRD}
            disabled={getSelectedCount() === 0}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" />
              <path d="M14 2V8H20" />
              <path d="M16 13H8" />
              <path d="M16 17H8" />
              <path d="M10 9H8" />
            </svg>
            Generate PRD
          </button>
          <div className="qc-requirements__download-group">
            <button
              type="button"
              className="qc-requirements__action-btn qc-requirements__action-btn--outline"
              onClick={handleDownloadJSON}
              disabled={getSelectedCount() === 0}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              JSON
            </button>
            <button
              type="button"
              className="qc-requirements__action-btn qc-requirements__action-btn--outline"
              onClick={handleDownloadMarkdown}
              disabled={getSelectedCount() === 0}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Markdown
            </button>
          </div>
        </div>
      </div>
    );
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
            <h1 className="qc-requirements__title">
              {extractedItems ? 'Extracted Requirements' : 'Extract Requirements'}
            </h1>
            <p className="qc-requirements__subtitle">
              {extractedItems
                ? 'Review and select the requirements you want to keep.'
                : 'Paste meeting notes, transcript, or any document to extract structured requirements.'}
            </p>
          </div>
        </div>

        {/* Conditional Content */}
        {isExtracting && renderProcessing()}
        {extractionError && !isExtracting && renderError()}
        {extractedItems && !isExtracting && renderResults()}
        {!extractedItems && !isExtracting && !extractionError && renderInputForm()}
      </section>

      {/* Save to Project Modal */}
      {showSaveModal && (
        <SaveToProjectModal
          onClose={() => setShowSaveModal(false)}
          dataType="requirements"
          data={getSelectedItems()}
        />
      )}
    </main>
  );
}

export default QuickConvertRequirementsPage;
