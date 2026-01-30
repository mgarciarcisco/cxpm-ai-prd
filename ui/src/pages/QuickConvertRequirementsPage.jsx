import React, { useState, useCallback, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SaveToProjectModal from '../components/quick-convert/SaveToProjectModal';
import { ConfirmationDialog } from '../components/common/ConfirmationDialog';
import { useNavigationWarning } from '../hooks/useNavigationWarning';
import { STORAGE_KEYS, saveToSession, loadFromSession, clearSession } from '../utils/sessionStorage';
import MeetingCard from '../components/requirements/MeetingCard';
import QuickConvertAddMeetingModal from '../components/requirements/QuickConvertAddMeetingModal';
import ResultsSidebar from '../components/requirements/ResultsSidebar';
import RequirementItem from '../components/requirements/RequirementItem';
import './QuickConvertRequirementsPage.css';

// Section metadata with display names
const SECTION_CONFIG = {
  problems: { label: 'Problems', icon: '⚠️' },
  user_goals: { label: 'User Goals', icon: '🎯' },
  functional_requirements: { label: 'Functional Requirements', icon: '⚙️' },
  non_functional_requirements: { label: 'Non-Functional', icon: '⚡' },
  technical: { label: 'Technical', icon: '💻' },
  business: { label: 'Business', icon: '💰' },
  data_needs: { label: 'Data Needs', icon: '📊' },
  constraints: { label: 'Constraints', icon: '🔒' },
  risks_assumptions: { label: 'Risks & Assumptions', icon: '⚡' },
  open_questions: { label: 'Open Questions', icon: '❓' },
};

// Section order for display
const SECTION_ORDER = [
  'problems',
  'user_goals',
  'functional_requirements',
  'non_functional_requirements',
  'technical',
  'business',
  'data_needs',
  'constraints',
  'risks_assumptions',
  'open_questions',
];

/**
 * Quick Convert Requirements page - redesigned with meeting-centric workflow.
 * Allows users to add multiple meetings, then extract structured requirements.
 */
function QuickConvertRequirementsPage() {
  const navigate = useNavigate();

  // Meeting management state
  const [meetings, setMeetings] = useState([]);
  const [expandedMeetingId, setExpandedMeetingId] = useState(null);
  const [showAddMeetingModal, setShowAddMeetingModal] = useState(false);

  // Extraction state
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState(null);
  const [extractedItems, setExtractedItems] = useState(null); // { section: [{ id, content, selected, sourceId, sourceName, sourceQuote }] }
  const [editingItem, setEditingItem] = useState(null); // { section, id }
  const [editValue, setEditValue] = useState('');

  // Filter state
  const [activeCategory, setActiveCategory] = useState('all');
  const [sourceFilters, setSourceFilters] = useState({}); // { meetingId: checked }

  // Next action state
  const [nextAction, setNextAction] = useState('save');

  // Modal state
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Session storage state
  const [restoredFromSession, setRestoredFromSession] = useState(false);

  // Track if data has been saved or downloaded (no warning needed after these actions)
  const [dataSaved, setDataSaved] = useState(false);

  // Navigation warning - warn when there's extracted data that hasn't been saved/downloaded
  const hasUnsavedWork = (extractedItems !== null || meetings.length > 0) && !dataSaved;
  const {
    showDialog: showNavWarning,
    confirmNavigation,
    cancelNavigation,
  } = useNavigationWarning({
    hasUnsavedChanges: hasUnsavedWork,
    message: 'You have unsaved requirements. Are you sure you want to leave?',
  });

  // Restore data from session storage on mount
  useEffect(() => {
    const stored = loadFromSession(STORAGE_KEYS.REQUIREMENTS);
    if (stored?.data?.extractedItems) {
      setExtractedItems(stored.data.extractedItems);
      setRestoredFromSession(true);
      // Initialize source filters from extracted items
      const sources = new Set();
      Object.values(stored.data.extractedItems).forEach(items => {
        items.forEach(item => {
          if (item.sourceId) sources.add(item.sourceId);
        });
      });
      const filters = {};
      sources.forEach(id => { filters[id] = true; });
      setSourceFilters(filters);
    }
    if (stored?.data?.meetings) {
      setMeetings(stored.data.meetings);
    }
  }, []);

  // Save to session storage when state changes
  useEffect(() => {
    if (extractedItems || meetings.length > 0) {
      saveToSession(STORAGE_KEYS.REQUIREMENTS, { extractedItems, meetings });
    }
  }, [extractedItems, meetings]);

  // Initialize source filters when meetings change
  useEffect(() => {
    if (meetings.length > 0 && Object.keys(sourceFilters).length === 0) {
      const filters = {};
      meetings.forEach(m => { filters[m.id] = true; });
      setSourceFilters(filters);
    }
  }, [meetings, sourceFilters]);

  // Meeting management handlers
  const handleAddMeeting = (meeting) => {
    setMeetings(prev => [...prev, meeting]);
    setSourceFilters(prev => ({ ...prev, [meeting.id]: true }));
  };

  const handleRemoveMeeting = (meetingId) => {
    setMeetings(prev => prev.filter(m => m.id !== meetingId));
    if (expandedMeetingId === meetingId) {
      setExpandedMeetingId(null);
    }
    setSourceFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[meetingId];
      return newFilters;
    });
  };

  const handleToggleExpand = (meetingId) => {
    setExpandedMeetingId(prev => prev === meetingId ? null : meetingId);
  };

  const handleUpdateMeeting = (meetingId, updates) => {
    setMeetings(prev => prev.map(m =>
      m.id === meetingId ? { ...m, ...updates } : m
    ));
  };

  // Simulated extraction - in production this would call the backend API
  const simulateExtraction = useCallback(async (meetingsList) => {
    // Simulate API latency
    await new Promise(resolve => setTimeout(resolve, 1500));

    const items = {};
    SECTION_ORDER.forEach(section => {
      items[section] = [];
    });

    let idCounter = 1;

    // Process each meeting
    meetingsList.forEach(meeting => {
      const text = `${meeting.transcript || ''}\n${meeting.notes || ''}`;
      const lines = text.split('\n').filter(line => line.trim());

      lines.forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine.length < 10) return;

        // Remove common list markers
        const cleanedLine = trimmedLine
          .replace(/^[-*•]\s*/, '')
          .replace(/^\d+[.)]\s*/, '')
          .trim();

        if (!cleanedLine) return;

        const lowerLine = cleanedLine.toLowerCase();
        let section = 'functional_requirements';

        // Categorize based on keywords
        if (lowerLine.includes('problem') || lowerLine.includes('issue') || lowerLine.includes('pain point') || lowerLine.includes('challenge')) {
          section = 'problems';
        } else if (lowerLine.includes('goal') || lowerLine.includes('want') || lowerLine.includes('need to') || lowerLine.includes('user should')) {
          section = 'user_goals';
        } else if (lowerLine.includes('performance') || lowerLine.includes('scalab') || lowerLine.includes('security') || lowerLine.includes('reliab')) {
          section = 'non_functional_requirements';
        } else if (lowerLine.includes('api') || lowerLine.includes('database') || lowerLine.includes('architect') || lowerLine.includes('technical')) {
          section = 'technical';
        } else if (lowerLine.includes('business') || lowerLine.includes('revenue') || lowerLine.includes('cost') || lowerLine.includes('roi')) {
          section = 'business';
        } else if (lowerLine.includes('data') || lowerLine.includes('store') || lowerLine.includes('field')) {
          section = 'data_needs';
        } else if (lowerLine.includes('constraint') || lowerLine.includes('must not') || lowerLine.includes('limitation')) {
          section = 'constraints';
        } else if (lowerLine.includes('risk') || lowerLine.includes('assume') || lowerLine.includes('assumption')) {
          section = 'risks_assumptions';
        } else if (lowerLine.includes('question') || lowerLine.includes('unclear') || lowerLine.includes('?') || lowerLine.includes('tbd')) {
          section = 'open_questions';
        }

        items[section].push({
          id: `item-${idCounter++}`,
          content: cleanedLine,
          selected: true,
          sourceId: meeting.id,
          sourceName: meeting.name,
          sourceQuote: `"...${trimmedLine.substring(0, 100)}${trimmedLine.length > 100 ? '...' : ''}"`,
        });
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
        content: 'No specific requirements could be extracted. Please review your meeting content.',
        selected: true,
        sourceId: meetingsList[0]?.id,
        sourceName: meetingsList[0]?.name || 'Unknown',
        sourceQuote: null,
      }];
    }

    return filteredItems;
  }, []);

  const handleExtract = async () => {
    if (meetings.length === 0) return;

    setIsExtracting(true);
    setExtractionError(null);
    setExtractedItems(null);

    try {
      const items = await simulateExtraction(meetings);
      setExtractedItems(items);
      setActiveCategory('all');
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
    setMeetings([]);
    setExpandedMeetingId(null);
    setRestoredFromSession(false);
    setDataSaved(false);
    setActiveCategory('all');
    setSourceFilters({});
    clearSession(STORAGE_KEYS.REQUIREMENTS);
  };

  // Filter items by category and source
  const getFilteredItems = useCallback(() => {
    if (!extractedItems) return {};

    const filtered = {};
    const sectionsToShow = activeCategory === 'all' ? SECTION_ORDER : [activeCategory];

    sectionsToShow.forEach(section => {
      if (!extractedItems[section]) return;

      const sectionItems = extractedItems[section].filter(item =>
        !item.sourceId || sourceFilters[item.sourceId] !== false
      );

      if (sectionItems.length > 0) {
        filtered[section] = sectionItems;
      }
    });

    return filtered;
  }, [extractedItems, activeCategory, sourceFilters]);

  // Get count of selected items
  const getSelectedCount = useCallback(() => {
    if (!extractedItems) return 0;
    return Object.values(extractedItems).reduce(
      (total, items) => total + items.filter(item => item.selected).length,
      0
    );
  }, [extractedItems]);

  // Get total item count
  const getTotalCount = useCallback(() => {
    if (!extractedItems) return 0;
    return Object.values(extractedItems).reduce(
      (total, items) => total + items.length,
      0
    );
  }, [extractedItems]);

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

  // Build categories for sidebar
  const getCategories = useCallback(() => {
    if (!extractedItems) return [];

    const totalCount = getTotalCount();
    const categories = [
      { key: 'all', label: 'All', icon: '📋', count: totalCount },
    ];

    SECTION_ORDER.forEach(section => {
      if (extractedItems[section]?.length > 0) {
        const config = SECTION_CONFIG[section];
        categories.push({
          key: section,
          label: config?.label || section,
          icon: config?.icon || '📄',
          count: extractedItems[section].length,
        });
      }
    });

    return categories;
  }, [extractedItems, getTotalCount]);

  // Build sources for sidebar
  const getSources = useCallback(() => {
    return meetings.map(m => ({
      id: m.id,
      name: m.name,
      checked: sourceFilters[m.id] !== false,
    }));
  }, [meetings, sourceFilters]);

  // Handle source filter toggle
  const handleSourceToggle = (sourceId) => {
    setSourceFilters(prev => ({
      ...prev,
      [sourceId]: !prev[sourceId],
    }));
  };

  // Handle continue action
  const handleContinue = () => {
    if (nextAction === 'save') {
      setShowSaveModal(true);
    } else if (nextAction === 'stories') {
      handleGenerateStories();
    }
  };

  // Navigate to Generate Stories with requirements data
  const handleGenerateStories = () => {
    const selectedItems = getSelectedItems();
    const requirementsText = Object.entries(selectedItems)
      .map(([section, items]) => {
        const sectionLabel = SECTION_CONFIG[section]?.label || section;
        const itemsText = items.map(item => `- ${item.content}`).join('\n');
        return `## ${sectionLabel}\n${itemsText}`;
      })
      .join('\n\n');

    setDataSaved(true);

    navigate('/quick-convert/stories', {
      state: {
        requirements: selectedItems,
        requirementsText,
        source: 'requirements-extraction',
      },
    });
  };

  // Render the input form (when no results yet)
  const renderInputForm = () => (
    <>
      {/* Meetings Section */}
      <div className="qc-requirements__meetings-section">
        <div className="qc-requirements__meetings-header">
          <div className="qc-requirements__meetings-title">
            Meetings
            <span className="qc-requirements__meetings-count">{meetings.length}</span>
          </div>
          <button
            type="button"
            className="qc-requirements__add-meeting-btn"
            onClick={() => setShowAddMeetingModal(true)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add Meeting
          </button>
        </div>

        {meetings.length === 0 ? (
          <div className="qc-requirements__meetings-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            <p>No meetings added yet</p>
            <button
              type="button"
              className="qc-requirements__add-first-btn"
              onClick={() => setShowAddMeetingModal(true)}
            >
              Add your first meeting
            </button>
          </div>
        ) : (
          <div className="qc-requirements__meetings-list">
            {meetings.map(meeting => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                isExpanded={expandedMeetingId === meeting.id}
                onToggleExpand={() => handleToggleExpand(meeting.id)}
                onRemove={() => handleRemoveMeeting(meeting.id)}
                onUpdate={(updates) => handleUpdateMeeting(meeting.id, updates)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Action Button */}
      <div className="qc-requirements__actions">
        <button
          type="button"
          className="qc-requirements__extract-btn"
          onClick={handleExtract}
          disabled={meetings.length === 0}
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
        Analyzing your meetings and categorizing requirements...
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

  // Render results with sidebar
  const renderResults = () => {
    const filteredItems = getFilteredItems();
    const sections = Object.keys(filteredItems);

    return (
      <div className="qc-requirements__results-layout">
        {/* Sidebar */}
        <ResultsSidebar
          categories={getCategories()}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          sources={getSources()}
          onSourceToggle={handleSourceToggle}
          selectedCount={getSelectedCount()}
          totalCount={getTotalCount()}
          nextAction={nextAction}
          onNextActionChange={setNextAction}
          onContinue={handleContinue}
          onStartOver={handleStartOver}
        />

        {/* Main Content */}
        <div className="qc-requirements__results-main">
          {restoredFromSession && (
            <div className="qc-requirements__restored-banner">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              Restored from previous session
            </div>
          )}

          {SECTION_ORDER.filter(section => sections.includes(section)).map(section => {
            const config = SECTION_CONFIG[section];
            const items = filteredItems[section];
            const allSelected = items.every(item => item.selected);
            const someSelected = items.some(item => item.selected);

            return (
              <div key={section} className="qc-requirements__category-section">
                <div className="qc-requirements__category-header">
                  <label className="qc-requirements__category-checkbox-wrapper">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={el => {
                        if (el) el.indeterminate = someSelected && !allSelected;
                      }}
                      onChange={() => handleToggleSection(section)}
                      className="qc-requirements__category-checkbox"
                    />
                    <span className="qc-requirements__category-icon">{config.icon}</span>
                    <span className="qc-requirements__category-name">{config.label}</span>
                    <span className="qc-requirements__category-count">({items.length})</span>
                  </label>
                </div>

                <div className="qc-requirements__items-list">
                  {items.map(item => {
                    const isEditing = editingItem?.section === section && editingItem?.id === item.id;

                    return (
                      <RequirementItem
                        key={item.id}
                        item={item}
                        onToggle={() => handleToggleItem(section, item.id)}
                        onEdit={() => handleStartEdit(section, item.id, item.content)}
                        onDelete={() => handleDeleteItem(section, item.id)}
                        isEditing={isEditing}
                        editValue={editValue}
                        onEditChange={setEditValue}
                        onSaveEdit={handleSaveEdit}
                        onCancelEdit={handleCancelEdit}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}

          {sections.length === 0 && (
            <div className="qc-requirements__no-results">
              <p>No requirements match the current filters.</p>
              <button
                type="button"
                className="qc-requirements__reset-filters-btn"
                onClick={() => {
                  setActiveCategory('all');
                  const allChecked = {};
                  meetings.forEach(m => { allChecked[m.id] = true; });
                  setSourceFilters(allChecked);
                }}
              >
                Reset Filters
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <main className="main-content">
      <section className="qc-requirements">
        {/* Back Link */}
        <Link to="/dashboard" className="qc-requirements__back-link">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to Dashboard
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
              {extractedItems ? 'Extracted Requirements' : 'Convert Meeting Notes to Requirements'}
            </h1>
            <p className="qc-requirements__subtitle">
              {extractedItems
                ? 'Review and select the requirements you want to keep.'
                : 'Add meetings and extract structured requirements.'}
            </p>
          </div>
        </div>

        {/* Conditional Content */}
        {isExtracting && renderProcessing()}
        {extractionError && !isExtracting && renderError()}
        {extractedItems && !isExtracting && renderResults()}
        {!extractedItems && !isExtracting && !extractionError && renderInputForm()}
      </section>

      {/* Add Meeting Modal */}
      <QuickConvertAddMeetingModal
        isOpen={showAddMeetingModal}
        onClose={() => setShowAddMeetingModal(false)}
        onAdd={handleAddMeeting}
      />

      {/* Save to Project Modal */}
      {showSaveModal && (
        <SaveToProjectModal
          onClose={() => {
            setShowSaveModal(false);
            setDataSaved(true);
          }}
          dataType="requirements"
          data={getSelectedItems()}
        />
      )}

      {/* Navigation Warning Dialog */}
      <ConfirmationDialog
        isOpen={showNavWarning}
        onClose={cancelNavigation}
        onConfirm={confirmNavigation}
        title="Leave page?"
        message="You have unsaved requirements. If you leave now, your extracted data will be lost."
        confirmLabel="Leave"
        cancelLabel="Stay"
        variant="warning"
      />
    </main>
  );
}

export default QuickConvertRequirementsPage;
