import { useState, useCallback } from 'react';
import { put } from '../../services/api';
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
 */
export function RecapEditor({ meetingId, items = [], onEditItem, onDeleteItem, onReorderItems }) {
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverItem, setDragOverItem] = useState(null);
  const [isReordering, setIsReordering] = useState(false);
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
        return (
          <CollapsibleSection
            key={section.key}
            title={section.label}
            itemCount={sectionItems.length}
            defaultExpanded={true}
          >
            {sectionItems.length > 0 ? (
              <div className="recap-editor-items">
                {sectionItems.map((item) => (
                  <div key={item.id} className="recap-editor-item-wrapper">
                    <ItemRow
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
                    {item.source_quote && (
                      <div className="recap-editor-source-quote">
                        <span className="recap-editor-source-label">Source:</span>
                        <span className="recap-editor-source-text">"{item.source_quote}"</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="recap-editor-empty">No items extracted for this section</p>
            )}
          </CollapsibleSection>
        );
      })}
    </div>
  );
}

export default RecapEditor;
