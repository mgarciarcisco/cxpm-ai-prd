import { useState, useCallback } from 'react';
import { post } from '../../services/api';
import { CollapsibleSection } from '../common/CollapsibleSection';
import { ItemRow } from '../common/ItemRow';
import './RecapEditor.css';

/**
 * Section configuration for display order and labels
 * Matches backend Section enum
 */
const SECTIONS = [
  { key: 'needs_and_goals', label: 'Needs & Goals' },
  { key: 'requirements', label: 'Requirements' },
  { key: 'scope_and_constraints', label: 'Scope & Constraints' },
  { key: 'risks_and_questions', label: 'Risks & Open Questions' },
  { key: 'action_items', label: 'Action Items' },
];

/**
 * RecapEditor component for viewing and editing extracted recap organized by sections.
 * Displays only the active section with its items using CollapsibleSection and ItemRow components.
 *
 * @param {Object} props
 * @param {string} props.meetingId - The meeting ID for API calls
 * @param {Array} props.items - Array of meeting items with section, content, source_quote, id
 * @param {string} props.activeSection - The currently selected section to display
 * @param {Function} props.onEditItem - Callback when edit is clicked on an item (item) => void
 * @param {Function} props.onDeleteItem - Callback when delete is clicked on an item (item) => void
 * @param {Function} props.onAddItem - Callback when a new item is added (newItem) => void
 * @param {boolean} props.readOnly - Whether editing controls should be hidden/disabled
 */
export function RecapEditor({
  meetingId,
  items = [],
  activeSection = 'needs_and_goals',
  onEditItem,
  onDeleteItem,
  onAddItem,
  readOnly = false,
}) {
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

  // Find the active section config
  const activeSectionConfig = SECTIONS.find(s => s.key === activeSection) || SECTIONS[0];
  const sectionItems = groupedItems[activeSectionConfig.key] || [];
  const nonEmptyItems = sectionItems.filter(item => item.content && item.content.trim());

  return (
    <div className="recap-editor">
      <div id={activeSectionConfig.key} className="recap-editor-section">
        <CollapsibleSection
          title={activeSectionConfig.label}
          itemCount={nonEmptyItems.length}
          defaultExpanded={true}
          variant={activeSectionConfig.key}
        >
          {nonEmptyItems.length > 0 ? (
            <div className="recap-editor-items">
              {nonEmptyItems.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  readOnly={readOnly}
                />
              ))}
            </div>
          ) : (
            <p className="recap-editor-empty">No items extracted for this section</p>
          )}

          {/* Add item functionality */}
          {!readOnly && (
            addingToSection === activeSectionConfig.key ? (
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
                onClick={() => handleStartAddItem(activeSectionConfig.key)}
                type="button"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 3.33334V12.6667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M3.33334 8H12.6667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Add item
              </button>
            )
          )}
        </CollapsibleSection>
      </div>
    </div>
  );
}

export default RecapEditor;
