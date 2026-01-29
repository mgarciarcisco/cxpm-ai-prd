import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from '../common/Modal';
import { get, post } from '../../services/api';
import { SECTION_ORDER } from './RequirementSection';
import './AddMeetingModal.css'; // Reuse the same styles

// Section labels for display
const SECTION_LABELS = {
  problems: 'Problems',
  user_goals: 'User Goals',
  functional_requirements: 'Functional Requirements',
  data_needs: 'Data Needs',
  constraints: 'Constraints',
  non_goals: 'Non-Goals',
  risks_assumptions: 'Risks & Assumptions',
  open_questions: 'Open Questions',
  action_items: 'Action Items',
};

/**
 * ViewMeetingModal - View and apply extracted items from a meeting
 */
function ViewMeetingModal({ meeting, projectId: _projectId, onClose, onSave }) {
  const [items, setItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Fetch meeting items
  useEffect(() => {
    const fetchMeetingItems = async () => {
      if (!meeting?.id) return;

      try {
        setLoading(true);
        setError(null);
        const data = await get(`/api/meetings/${meeting.id}`);

        // Filter to only non-deleted items
        const activeItems = (data.items || []).filter(item => !item.is_deleted);
        setItems(activeItems);

        // Pre-select all items
        setSelectedItems(new Set(activeItems.map((_, idx) => idx)));
      } catch (err) {
        setError(err.message || 'Failed to load meeting items');
        console.error('Error fetching meeting items:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMeetingItems();
  }, [meeting?.id]);

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
        sectionItems.forEach((item) => newSet.delete(item.index));
      } else {
        sectionItems.forEach((item) => newSet.add(item.index));
      }
      return newSet;
    });
  }, []);

  // Save selected items to project
  const handleSaveToProject = async () => {
    if (selectedItems.size === 0 || !meeting?.id) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      // Build decisions for selected items
      const decisions = items
        .map((item, index) => {
          if (selectedItems.has(index)) {
            return {
              item_id: item.id,
              decision: 'added',
            };
          }
          return null;
        })
        .filter(Boolean);

      // Call resolve endpoint
      const result = await post(`/api/meetings/${meeting.id}/resolve`, { decisions });

      // Notify parent of success
      if (onSave) {
        onSave(result.added);
      }

      onClose();
    } catch (err) {
      setSaveError(err.message || 'Failed to save requirements. Please try again.');
      setIsSaving(false);
    }
  };

  // Group items by section
  const groupedItems = items.reduce((acc, item, index) => {
    const section = item.section;
    if (!acc[section]) {
      acc[section] = [];
    }
    acc[section].push({ ...item, index });
    return acc;
  }, {});

  // Get sections in order, only including those with items
  const sectionsWithItems = SECTION_ORDER.filter((section) => groupedItems[section]?.length > 0);

  return (
    <Modal title={`Meeting: ${meeting?.title || 'Untitled'}`} onClose={onClose}>
      <div className="add-meeting-modal add-meeting-modal--results">
        {loading ? (
          <div className="add-meeting-modal__loading">
            <span className="add-meeting-modal__spinner" aria-hidden="true" />
            <span>Loading items...</span>
          </div>
        ) : error ? (
          <div className="add-meeting-modal__error-state">
            <p>{error}</p>
            <button onClick={onClose}>Close</button>
          </div>
        ) : items.length === 0 ? (
          <div className="add-meeting-modal__empty">
            <p>No items were extracted from this meeting.</p>
            <button onClick={onClose}>Close</button>
          </div>
        ) : (
          <>
            {/* Description */}
            <p className="add-meeting-modal__description">
              Select the requirements you want to add to your project.{' '}
              <strong>{selectedItems.size}</strong> of <strong>{items.length}</strong> selected.
            </p>

            {/* Results sections */}
            <div className="add-meeting-modal__results">
              {sectionsWithItems.map((section) => {
                const sectionItems = groupedItems[section];
                const allSelected = sectionItems.every((item) => selectedItems.has(item.index));
                const someSelected = sectionItems.some((item) => selectedItems.has(item.index));

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
                          onChange={() => toggleSection(sectionItems)}
                          disabled={isSaving}
                        />
                        <span className="add-meeting-modal__section-title">
                          {SECTION_LABELS[section] || section}
                        </span>
                        <span className="add-meeting-modal__section-count">
                          ({sectionItems.length})
                        </span>
                      </label>
                    </div>
                    <div className="add-meeting-modal__section-items">
                      {sectionItems.map((item) => (
                        <label
                          key={item.id}
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
                          <span className="add-meeting-modal__item-content">{item.content}</span>
                          {item.source_quote && (
                            <span className="add-meeting-modal__item-source" title={item.source_quote}>
                              Source: "{item.source_quote.length > 50
                                ? item.source_quote.substring(0, 50) + '...'
                                : item.source_quote}"
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Error message */}
            {saveError && (
              <div className="add-meeting-modal__save-error">
                {saveError}
              </div>
            )}

            {/* Actions */}
            <div className="add-meeting-modal__actions">
              <button
                className="add-meeting-modal__cancel"
                onClick={onClose}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                className="add-meeting-modal__save"
                onClick={handleSaveToProject}
                disabled={selectedItems.size === 0 || isSaving}
              >
                {isSaving ? 'Saving...' : `Add ${selectedItems.size} to Project`}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export default ViewMeetingModal;
