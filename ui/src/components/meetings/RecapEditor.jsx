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
 * @param {Array} props.items - Array of meeting items with section, content, source_quote, id
 * @param {Function} props.onEditItem - Callback when edit is clicked on an item (item) => void
 * @param {Function} props.onDeleteItem - Callback when delete is clicked on an item (item) => void
 */
export function RecapEditor({ items = [], onEditItem, onDeleteItem }) {
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
