import { useState, useCallback, useEffect } from 'react';
import Modal from '../common/Modal';
import './StoryEditModal.css';

/**
 * StoryEditModal component for editing user story details.
 *
 * @param {Object} story - The user story to edit
 * @param {string} story.id - UUID of the story
 * @param {string} story.story_id - Formatted story ID (e.g., "US-001")
 * @param {string} story.title - Story title
 * @param {string} story.description - Story description
 * @param {Array<string>} story.acceptance_criteria - List of acceptance criteria
 * @param {string} story.size - Story size (xs, s, m, l, xl)
 * @param {string} story.priority - Story priority (low, medium, high, critical)
 * @param {Array<string>} story.labels - List of labels
 * @param {string} story.status - Story status (draft, ready, exported)
 * @param {function} onSave - Callback when story is saved, receives (storyId, updatedData)
 * @param {function} onClose - Callback when modal is closed
 * @param {boolean} isSaving - Whether save is in progress
 */
export function StoryEditModal({
  story,
  onSave,
  onClose,
  isSaving = false,
}) {
  // Form state
  const [title, setTitle] = useState(story?.title || '');
  const [description, setDescription] = useState(story?.description || '');
  const [acceptanceCriteria, setAcceptanceCriteria] = useState(
    story?.acceptance_criteria || []
  );
  const [size, setSize] = useState(story?.size?.toLowerCase?.() || 'm');
  const [priority, setPriority] = useState(story?.priority?.toLowerCase?.() || 'medium');
  const [labels, setLabels] = useState(story?.labels || []);
  const [status, setStatus] = useState(story?.status || 'draft');

  // UI state
  const [newLabelInput, setNewLabelInput] = useState('');
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [draggedCriterionIndex, setDraggedCriterionIndex] = useState(null);
  const [editingCriterionIndex, setEditingCriterionIndex] = useState(null);

  // Available sizes
  const SIZE_OPTIONS = [
    { value: 'xs', label: 'XS' },
    { value: 's', label: 'S' },
    { value: 'm', label: 'M' },
    { value: 'l', label: 'L' },
    { value: 'xl', label: 'XL' },
  ];

  // Available priorities
  const PRIORITY_OPTIONS = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'critical', label: 'Critical' },
  ];

  // Available statuses
  const STATUS_OPTIONS = [
    { value: 'draft', label: 'Draft' },
    { value: 'ready', label: 'Ready' },
    { value: 'exported', label: 'Exported' },
  ];

  // Check if form has changes
  const hasChanges = useCallback(() => {
    if (!story) return false;
    return (
      title !== story.title ||
      description !== story.description ||
      JSON.stringify(acceptanceCriteria) !== JSON.stringify(story.acceptance_criteria || []) ||
      size !== (story.size?.toLowerCase?.() || 'm') ||
      priority !== (story.priority?.toLowerCase?.() || 'medium') ||
      JSON.stringify(labels) !== JSON.stringify(story.labels || []) ||
      status !== story.status
    );
  }, [story, title, description, acceptanceCriteria, size, priority, labels, status]);

  // Handle close with unsaved changes warning
  const handleClose = useCallback(() => {
    if (hasChanges() && !isSaving) {
      setShowUnsavedWarning(true);
    } else {
      onClose();
    }
  }, [hasChanges, isSaving, onClose]);

  // Handle save
  const handleSave = useCallback(() => {
    if (!story || isSaving) return;

    const updatedData = {
      title: title.trim(),
      description: description.trim(),
      acceptance_criteria: acceptanceCriteria.filter(c => c.trim()),
      size,
      priority,
      labels: labels.filter(l => l.trim()),
      status,
    };

    onSave(story.id, updatedData);
  }, [story, title, description, acceptanceCriteria, size, priority, labels, status, isSaving, onSave]);

  // --- Acceptance Criteria Management ---

  const addCriterion = useCallback(() => {
    setAcceptanceCriteria([...acceptanceCriteria, '']);
    // Focus on the new criterion after render
    setTimeout(() => {
      setEditingCriterionIndex(acceptanceCriteria.length);
    }, 0);
  }, [acceptanceCriteria]);

  const updateCriterion = useCallback((index, value) => {
    const updated = [...acceptanceCriteria];
    updated[index] = value;
    setAcceptanceCriteria(updated);
  }, [acceptanceCriteria]);

  const removeCriterion = useCallback((index) => {
    setAcceptanceCriteria(acceptanceCriteria.filter((_, i) => i !== index));
  }, [acceptanceCriteria]);

  const moveCriterion = useCallback((fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= acceptanceCriteria.length) return;
    const updated = [...acceptanceCriteria];
    const [removed] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, removed);
    setAcceptanceCriteria(updated);
  }, [acceptanceCriteria]);

  // Drag and drop handlers for criteria reordering
  const handleDragStart = useCallback((e, index) => {
    setDraggedCriterionIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e, index) => {
    e.preventDefault();
    if (draggedCriterionIndex === null || draggedCriterionIndex === index) return;
  }, [draggedCriterionIndex]);

  const handleDrop = useCallback((e, index) => {
    e.preventDefault();
    if (draggedCriterionIndex === null || draggedCriterionIndex === index) return;
    moveCriterion(draggedCriterionIndex, index);
    setDraggedCriterionIndex(null);
  }, [draggedCriterionIndex, moveCriterion]);

  const handleDragEnd = useCallback(() => {
    setDraggedCriterionIndex(null);
  }, []);

  // --- Labels Management ---

  const addLabel = useCallback(() => {
    const trimmed = newLabelInput.trim();
    if (trimmed && !labels.includes(trimmed)) {
      setLabels([...labels, trimmed]);
      setNewLabelInput('');
    }
  }, [newLabelInput, labels]);

  const removeLabel = useCallback((labelToRemove) => {
    setLabels(labels.filter(l => l !== labelToRemove));
  }, [labels]);

  const handleLabelKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addLabel();
    }
  }, [addLabel]);

  // Handle Ctrl+S to save
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (!isSaving && hasChanges()) {
          handleSave();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, isSaving, hasChanges]);

  if (!story) return null;

  return (
    <>
      <Modal
        onClose={handleClose}
        title={`Edit Story ${story.story_id}`}
      >
        <div className="story-edit-modal">
          {/* Title */}
          <div className="story-edit-field">
            <label htmlFor="story-title" className="story-edit-label">
              Title <span className="story-edit-required">*</span>
            </label>
            <input
              id="story-title"
              type="text"
              className="story-edit-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter story title"
              disabled={isSaving}
            />
          </div>

          {/* Description */}
          <div className="story-edit-field">
            <label htmlFor="story-description" className="story-edit-label">
              Description
            </label>
            <textarea
              id="story-description"
              className="story-edit-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="As a [user], I want [goal], so that [benefit]"
              rows={4}
              disabled={isSaving}
            />
          </div>

          {/* Acceptance Criteria */}
          <div className="story-edit-field">
            <div className="story-edit-label-row">
              <label className="story-edit-label">
                Acceptance Criteria ({acceptanceCriteria.length})
              </label>
              <button
                type="button"
                className="story-edit-add-btn"
                onClick={addCriterion}
                disabled={isSaving}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Add Criterion
              </button>
            </div>
            <div className="story-edit-criteria-list">
              {acceptanceCriteria.length === 0 ? (
                <p className="story-edit-criteria-empty">
                  No acceptance criteria. Click "Add Criterion" to add one.
                </p>
              ) : (
                acceptanceCriteria.map((criterion, index) => (
                  <div
                    key={index}
                    className={`story-edit-criterion ${draggedCriterionIndex === index ? 'story-edit-criterion--dragging' : ''}`}
                    draggable={!isSaving}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                  >
                    {/* Drag handle */}
                    <button
                      type="button"
                      className="story-edit-criterion-handle"
                      aria-label="Drag to reorder"
                      disabled={isSaving}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="9" cy="6" r="1.5"/>
                        <circle cx="15" cy="6" r="1.5"/>
                        <circle cx="9" cy="12" r="1.5"/>
                        <circle cx="15" cy="12" r="1.5"/>
                        <circle cx="9" cy="18" r="1.5"/>
                        <circle cx="15" cy="18" r="1.5"/>
                      </svg>
                    </button>
                    
                    {/* Criterion input */}
                    <input
                      type="text"
                      className="story-edit-criterion-input"
                      value={criterion}
                      onChange={(e) => updateCriterion(index, e.target.value)}
                      placeholder={`Criterion ${index + 1}`}
                      disabled={isSaving}
                      autoFocus={editingCriterionIndex === index}
                      onFocus={() => setEditingCriterionIndex(index)}
                      onBlur={() => setEditingCriterionIndex(null)}
                    />
                    
                    {/* Move buttons */}
                    <div className="story-edit-criterion-move">
                      <button
                        type="button"
                        className="story-edit-criterion-move-btn"
                        onClick={() => moveCriterion(index, index - 1)}
                        disabled={isSaving || index === 0}
                        aria-label="Move up"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="18 15 12 9 6 15"/>
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="story-edit-criterion-move-btn"
                        onClick={() => moveCriterion(index, index + 1)}
                        disabled={isSaving || index === acceptanceCriteria.length - 1}
                        aria-label="Move down"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </button>
                    </div>

                    {/* Remove button */}
                    <button
                      type="button"
                      className="story-edit-criterion-remove"
                      onClick={() => removeCriterion(index)}
                      disabled={isSaving}
                      aria-label="Remove criterion"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Size, Priority, and Status Row */}
          <div className="story-edit-row">
            {/* Size Selector */}
            <div className="story-edit-field story-edit-field--third">
              <label htmlFor="story-size" className="story-edit-label">
                Size
              </label>
              <select
                id="story-size"
                className="story-edit-select"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                disabled={isSaving}
              >
                {SIZE_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <p className="story-edit-hint">
                XS: &lt;1h, S: &lt;4h, M: &lt;1d, L: &lt;3d, XL: &lt;1w
              </p>
            </div>

            {/* Priority Selector */}
            <div className="story-edit-field story-edit-field--third">
              <label htmlFor="story-priority" className="story-edit-label">
                Priority
              </label>
              <select
                id="story-priority"
                className="story-edit-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                disabled={isSaving}
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            {/* Status Selector */}
            <div className="story-edit-field story-edit-field--third">
              <label htmlFor="story-status" className="story-edit-label">
                Status
              </label>
              <select
                id="story-status"
                className="story-edit-select"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                disabled={isSaving}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Labels */}
          <div className="story-edit-field">
            <label className="story-edit-label">
              Labels
            </label>
            <div className="story-edit-labels-container">
              {/* Existing labels */}
              {labels.length > 0 && (
                <div className="story-edit-labels-list">
                  {labels.map((label, index) => (
                    <span key={index} className="story-edit-label-chip">
                      {label}
                      <button
                        type="button"
                        className="story-edit-label-remove"
                        onClick={() => removeLabel(label)}
                        disabled={isSaving}
                        aria-label={`Remove label ${label}`}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18"/>
                          <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {/* Add new label */}
              <div className="story-edit-label-add">
                <input
                  type="text"
                  className="story-edit-label-input"
                  value={newLabelInput}
                  onChange={(e) => setNewLabelInput(e.target.value)}
                  onKeyDown={handleLabelKeyDown}
                  placeholder="Type and press Enter to add"
                  disabled={isSaving}
                />
                <button
                  type="button"
                  className="story-edit-label-add-btn"
                  onClick={addLabel}
                  disabled={isSaving || !newLabelInput.trim()}
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="story-edit-actions">
            <button
              type="button"
              className="story-edit-cancel-btn"
              onClick={handleClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="story-edit-save-btn"
              onClick={handleSave}
              disabled={isSaving || !title.trim()}
            >
              {isSaving ? (
                <>
                  <span className="story-edit-save-spinner"></span>
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Unsaved Changes Warning Modal */}
      {showUnsavedWarning && (
        <Modal
          onClose={() => setShowUnsavedWarning(false)}
          title="Unsaved Changes"
        >
          <div className="story-edit-unsaved-modal">
            <p className="story-edit-unsaved-message">
              You have unsaved changes. Are you sure you want to discard them?
            </p>
            <div className="story-edit-unsaved-actions">
              <button
                type="button"
                className="story-edit-unsaved-stay-btn"
                onClick={() => setShowUnsavedWarning(false)}
              >
                Continue Editing
              </button>
              <button
                type="button"
                className="story-edit-unsaved-discard-btn"
                onClick={() => {
                  setShowUnsavedWarning(false);
                  onClose();
                }}
              >
                Discard Changes
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

export default StoryEditModal;
