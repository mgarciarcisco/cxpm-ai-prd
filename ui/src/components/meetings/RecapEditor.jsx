import { useState, useCallback } from 'react';
import { put, post } from '../../services/api';
import { CollapsibleSection } from '../common/CollapsibleSection';
import { ItemRow } from '../common/ItemRow';
import './RecapEditor.css';

/**
 * Section configuration for display order and labels
 * Matches backend Section enum
 */
const SECTIONS = [
  { key: 'problems', label: 'Problems' },
  { key: 'user_goals', label: 'User Goals' },
  { key: 'functional_requirements', label: 'Functional Requirements' },
  { key: 'data_needs', label: 'Data Needs' },
  { key: 'constraints', label: 'Constraints' },
  { key: 'non_goals', label: 'Non-Goals' },
  { key: 'risks_assumptions', label: 'Risks & Assumptions' },
  { key: 'open_questions', label: 'Open Questions' },
  { key: 'action_items', label: 'Action Items' },
];

/**
 * RecapEditor component for viewing and editing extracted recap organized by sections.
 * Displays all 9 sections with their items using CollapsibleSection and ItemRow components.
 *
 * @param {Object} props
 * @param {string} props.meetingId - The meeting ID for reorder API calls
 * @param {Array} props.items - Array of meeting items with section, content, source_quote, id
 * @param {Function} props.onEditItem - Callback when edit is clicked on an item (item) => void
 * @param {Function} props.onDeleteItem - Callback when delete is clicked on an item (item) => void
 * @param {Function} props.onReorderItems - Callback when items are reordered (section, newItemIds) => void
 * @param {Function} props.onAddItem - Callback when a new item is added (newItem) => void
 */
export function RecapEditor({ meetingId, items = [], onEditItem, onDeleteItem, onReorderItems, onAddItem }) {
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverItem, setDragOverItem] = useState(null);
  const [isReordering, setIsReordering] = useState(false);
  const [addingToSection, setAddingToSection] = useState(null);
  const [newItemContent, setNewItemContent] = useState('');
  const [isAddingSaving, setIsAddingSaving] = useState(false);
  const [addError, setAddError] = useState(null);
  // Group items by section
  const groupedItems = {};
  SECTIONS.forEach((section) => {
    groupedItems[section.key] = [];
  });
  items.forEach((item) => {
    if (groupedItems[item.section]) {
      groupedItems[item.section].push(item);
    }
  });

  const handleEdit = (item) => {
    if (onEditItem) {
      onEditItem(item);
    }
  };

  const handleDelete = (item) => {
    if (onDeleteItem) {
      onDeleteItem(item);
    }
  };

  const handleStartAddItem = useCallback((sectionKey) => {
    setAddingToSection(sectionKey);
    setNewItemContent('');
    setAddError(null);
  }, []);

  const handleCancelAddItem = useCallback(() => {
    setAddingToSection(null);
    setNewItemContent('');
    setAddError(null);
  }, []);

  const handleSubmitAddItem = useCallback(async () => {
    if (!newItemContent.trim() || !addingToSection) {
      return;
    }

    setIsAddingSaving(true);
    setAddError(null);

    try {
      const newItem = await post(`/api/meetings/${meetingId}/items`, {
        section: addingToSection,
        content: newItemContent.trim()
      });

      // Notify parent of the new item
      if (onAddItem) {
        onAddItem(newItem);
      }

      // Reset state
      setAddingToSection(null);
      setNewItemContent('');
    } catch (err) {
      setAddError(err.message || 'Failed to add item');
    } finally {
      setIsAddingSaving(false);
    }
  }, [addingToSection, newItemContent, meetingId, onAddItem]);

  const handleAddItemKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      handleCancelAddItem();
    } else if (e.key === 'Enter' && e.ctrlKey) {
      handleSubmitAddItem();
    }
  }, [handleCancelAddItem, handleSubmitAddItem]);

  const handleDragStart = useCallback((e, item) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
    // Add a slight delay to show the drag effect properly
    e.dataTransfer.setData('text/plain', item.id);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
    setDragOverItem(null);
  }, []);

  const handleDragOver = useCallback((e, item) => {
    // Only allow drop within the same section
    if (draggedItem && draggedItem.section === item.section && draggedItem.id !== item.id) {
      setDragOverItem(item);
    }
  }, [draggedItem]);

  const handleDragLeave = useCallback(() => {
    setDragOverItem(null);
  }, []);

  const handleDrop = useCallback(async (e, targetItem) => {
    e.preventDefault();

    if (!draggedItem || !targetItem || draggedItem.id === targetItem.id) {
      setDraggedItem(null);
      setDragOverItem(null);
      return;
    }

    // Only allow drops within the same section
    if (draggedItem.section !== targetItem.section) {
      setDraggedItem(null);
      setDragOverItem(null);
      return;
    }

    const section = draggedItem.section;
    const sectionItems = groupedItems[section];

    // Get indices
    const draggedIndex = sectionItems.findIndex(item => item.id === draggedItem.id);
    const targetIndex = sectionItems.findIndex(item => item.id === targetItem.id);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedItem(null);
      setDragOverItem(null);
      return;
    }

    // Create new order
    const newItems = [...sectionItems];
    newItems.splice(draggedIndex, 1);
    newItems.splice(targetIndex, 0, draggedItem);

    const newItemIds = newItems.map(item => item.id);

    setDraggedItem(null);
    setDragOverItem(null);
    setIsReordering(true);

    try {
      await put(`/api/meetings/${meetingId}/items/reorder`, {
        section: section,
        item_ids: newItemIds
      });

      // Notify parent of the reorder
      if (onReorderItems) {
        onReorderItems(section, newItemIds);
      }
    } catch (err) {
      console.error('Failed to reorder items:', err);
      // Could show a toast/error message here
    } finally {
      setIsReordering(false);
    }
  }, [draggedItem, groupedItems, meetingId, onReorderItems]);

  return (
    <div className="recap-editor">
      {SECTIONS.map((section) => {
        const sectionItems = groupedItems[section.key];
        // Filter out items with empty content for accurate count and display
        const nonEmptyItems = sectionItems.filter(item => item.content && item.content.trim());
        return (
          <div key={section.key} id={section.key} className="recap-editor-section">
            <CollapsibleSection
              title={section.label}
              itemCount={nonEmptyItems.length}
              defaultExpanded={true}
              variant={section.key}
            >
            {nonEmptyItems.length > 0 ? (
              <div className="recap-editor-items">
                {nonEmptyItems.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    draggable={!isReordering}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    isDragging={draggedItem?.id === item.id}
                    isDragOver={dragOverItem?.id === item.id}
                  />
                ))}
              </div>
            ) : (
              <p className="recap-editor-empty">No items extracted for this section</p>
            )}

            {/* Add item functionality */}
            {addingToSection === section.key ? (
              <div className="recap-editor-add-form">
                <textarea
                  className="recap-editor-add-textarea"
                  value={newItemContent}
                  onChange={(e) => setNewItemContent(e.target.value)}
                  onKeyDown={handleAddItemKeyDown}
                  placeholder="Enter new item content..."
                  rows={3}
                  autoFocus
                  disabled={isAddingSaving}
                />
                {addError && (
                  <div className="recap-editor-add-error">{addError}</div>
                )}
                <div className="recap-editor-add-actions">
                  <button
                    className="recap-editor-add-btn recap-editor-add-btn--cancel"
                    onClick={handleCancelAddItem}
                    disabled={isAddingSaving}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="recap-editor-add-btn recap-editor-add-btn--submit"
                    onClick={handleSubmitAddItem}
                    disabled={isAddingSaving || !newItemContent.trim()}
                    type="button"
                  >
                    {isAddingSaving ? 'Adding...' : 'Add Item'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="recap-editor-add-item-btn"
                onClick={() => handleStartAddItem(section.key)}
                type="button"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 3.33334V12.6667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M3.33334 8H12.6667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Add item
              </button>
            )}
            </CollapsibleSection>
          </div>
        );
      })}
    </div>
  );
}

export default RecapEditor;
