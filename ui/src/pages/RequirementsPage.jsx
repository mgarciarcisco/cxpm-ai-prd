import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { get, put } from '../services/api';
import { CollapsibleSection } from '../components/common/CollapsibleSection';
import { ItemRow } from '../components/common/ItemRow';
import { HistoryPopover } from '../components/requirements/HistoryPopover';
import { EmptyState } from '../components/common/EmptyState';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { Breadcrumbs } from '../components/common/Breadcrumbs';
import './RequirementsPage.css';

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

function RequirementsPage() {
  const { id } = useParams();
  const [requirements, setRequirements] = useState(null);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Export state
  const [isExporting, setIsExporting] = useState(false);

  // Drag-and-drop state
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverItem, setDragOverItem] = useState(null);
  const [isReordering, setIsReordering] = useState(false);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [projectData, requirementsData] = await Promise.all([
        get(`/api/projects/${id}`),
        get(`/api/projects/${id}/requirements`)
      ]);
      setProject(projectData);
      setRequirements(requirementsData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle export button click - downloads requirements as Markdown file
   */
  const handleExport = async () => {
    try {
      setIsExporting(true);
      const response = await fetch(`${import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:8000')}/api/projects/${id}/requirements/export`);
      if (!response.ok) {
        throw new Error('Export failed');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const filename = project?.name
        ? `${project.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}-requirements.md`
        : 'requirements.md';
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * Handle edit callback from ItemRow - updates local state with the updated item
   * @param {Object} updatedItem - The updated requirement from the API
   */
  const handleEditItem = (updatedItem) => {
    setRequirements((prev) => {
      if (!prev) return prev;
      const newRequirements = { ...prev };
      // Find and update the item in the correct section
      Object.keys(newRequirements).forEach((sectionKey) => {
        newRequirements[sectionKey] = newRequirements[sectionKey].map((item) =>
          item.id === updatedItem.id ? { ...item, content: updatedItem.content } : item
        );
      });
      return newRequirements;
    });
  };

  /**
   * Handle delete callback from ItemRow - removes the deleted item from local state
   * @param {Object} deletedItem - The deleted requirement
   */
  const handleDeleteItem = (deletedItem) => {
    setRequirements((prev) => {
      if (!prev) return prev;
      const newRequirements = { ...prev };
      // Find and remove the item from the correct section
      Object.keys(newRequirements).forEach((sectionKey) => {
        newRequirements[sectionKey] = newRequirements[sectionKey].filter(
          (item) => item.id !== deletedItem.id
        );
      });
      return newRequirements;
    });
  };

  // Drag-and-drop handlers
  const handleDragStart = useCallback((e, item) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
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
    const sectionItems = requirements?.[section] || [];

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
      await put(`/api/projects/${id}/requirements/reorder`, {
        section: section,
        requirement_ids: newItemIds
      });

      // Update local state with new order
      setRequirements((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          [section]: newItems
        };
      });
    } catch (err) {
      console.error('Failed to reorder requirements:', err);
      // Could show a toast/error message here
    } finally {
      setIsReordering(false);
    }
  }, [draggedItem, requirements, id]);

  // Breadcrumb items
  const breadcrumbItems = useMemo(() => [
    { label: 'Dashboard', href: '/dashboard' },
    { label: project?.name || 'Project', href: `/app/projects/${id}` },
    { label: 'Requirements' }
  ], [project?.name, id]);

  // Calculate total requirement count
  const totalRequirementCount = useMemo(() => {
    if (!requirements) return 0;
    return SECTIONS.reduce((total, section) => {
      const items = requirements[section.key] || [];
      return total + items.filter(item => item.content && item.content.trim()).length;
    }, 0);
  }, [requirements]);

  if (loading) {
    return (
      <main className="main-content">
        <div className="requirements-page">
          <div className="requirements-loading">
            <LoadingSpinner size="large" />
            <p>Loading requirements...</p>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="main-content">
        <div className="requirements-page">
          <div className="requirements-error">
            <p>Error loading requirements: {error}</p>
            <button onClick={fetchData} className="retry-btn">Retry</button>
          </div>
        </div>
      </main>
    );
  }

  // Check if all sections are empty
  const hasNoRequirements = !requirements || SECTIONS.every(
    (section) => !requirements[section.key] || requirements[section.key].length === 0
  );

  return (
    <main className="main-content">
      <div className="requirements-page">
        <Breadcrumbs items={breadcrumbItems} />

        <section className="requirements-section">
          <div className="section-header">
            <div className="section-header-title">
              <h2>Requirements</h2>
              <span className="requirements-count">
                {totalRequirementCount} {totalRequirementCount === 1 ? 'item' : 'items'}
              </span>
            </div>
            <button
              onClick={handleExport}
              disabled={isExporting || hasNoRequirements}
              className="export-btn"
              title={hasNoRequirements ? 'No requirements to export' : 'Download as Markdown file'}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 10V12.6667C14 13.0203 13.8595 13.3594 13.6095 13.6095C13.3594 13.8595 13.0203 14 12.6667 14H3.33333C2.97971 14 2.64057 13.8595 2.39052 13.6095C2.14048 13.3594 2 13.0203 2 12.6667V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M4.66666 6.66667L8 10L11.3333 6.66667" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 10V2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {isExporting ? 'Exporting...' : 'Export'}
            </button>
          </div>

          {hasNoRequirements ? (
            <div className="requirements-empty-state-container">
              <EmptyState
                icon={
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M38 8H10C7.79086 8 6 9.79086 6 12V38C6 40.2091 7.79086 42 10 42H38C40.2091 42 42 40.2091 42 38V12C42 9.79086 40.2091 8 38 8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M16 16H32" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M16 24H32" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M16 32H26" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                }
                title="No requirements yet"
                description="Upload meeting notes, extract items, then apply them to build your requirements document."
              />
            </div>
          ) : (
            <div className="requirements-content">
              {SECTIONS.map((section) => {
                const sectionItems = requirements?.[section.key] || [];
                // Filter out items with empty content for accurate count
                const nonEmptyItems = sectionItems.filter(item => item.content && item.content.trim());
                return (
                  <div key={section.key} id={section.key} className="requirements-section-wrapper">
                    <CollapsibleSection
                      title={section.label}
                      itemCount={nonEmptyItems.length}
                      defaultExpanded={true}
                      variant={section.key}
                    >
                      {nonEmptyItems.length > 0 ? (
                        <div className="requirements-items">
                          {nonEmptyItems.map((item) => (
                            <div key={item.id} className="requirements-item-wrapper">
                              <ItemRow
                                item={item}
                                onEdit={handleEditItem}
                                onDelete={handleDeleteItem}
                                apiEndpoint="requirements"
                                draggable={!isReordering}
                                onDragStart={handleDragStart}
                                onDragEnd={handleDragEnd}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                isDragging={draggedItem?.id === item.id}
                                isDragOver={dragOverItem?.id === item.id}
                              />
                              <div className="requirement-meta">
                                {item.sources && item.sources.length > 0 && (
                                  <div className="requirement-sources">
                                    {item.sources
                                      .filter(source => source.meeting_id)
                                      .map((source) => (
                                        <Link
                                          key={source.id}
                                          to={`/app/projects/${id}/meetings/${source.meeting_id}`}
                                          className="requirement-source-chip"
                                        >
                                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M14 8H2M14 8L9 3M14 8L9 13"/>
                                          </svg>
                                          {source.meeting_title || 'Meeting'}
                                        </Link>
                                      ))}
                                  </div>
                                )}
                                {item.history_count > 0 && (
                                  <HistoryPopover requirementId={item.id} />
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="requirements-empty">No requirements in this section</p>
                      )}
                    </CollapsibleSection>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default RequirementsPage;
