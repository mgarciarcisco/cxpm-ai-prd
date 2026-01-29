import React, { useState, useEffect, useCallback } from 'react';
import JSZip from 'jszip';
import { StageHeader } from '../stage/StageHeader';
import { get, listPRDs, listStories } from '../../services/api';
import './StageContent.css';
import './ExportStage.css';

/**
 * localStorage key for export history
 */
const EXPORT_HISTORY_KEY = 'export-history';

/**
 * Get export history from localStorage for a specific project.
 */
function getExportHistory(projectId) {
  try {
    const stored = localStorage.getItem(EXPORT_HISTORY_KEY);
    if (!stored) return [];
    const history = JSON.parse(stored);
    return history.filter(item => item.projectId === projectId);
  } catch {
    return [];
  }
}

/**
 * Save export entry to localStorage.
 */
function saveExportEntry(entry) {
  try {
    const stored = localStorage.getItem(EXPORT_HISTORY_KEY);
    const history = stored ? JSON.parse(stored) : [];
    history.unshift(entry);
    // Keep only the last 50 entries
    const trimmed = history.slice(0, 50);
    localStorage.setItem(EXPORT_HISTORY_KEY, JSON.stringify(trimmed));
    return trimmed.filter(item => item.projectId === entry.projectId);
  } catch {
    return [];
  }
}

/**
 * Clear export history for a specific project.
 */
function clearExportHistory(projectId) {
  try {
    const stored = localStorage.getItem(EXPORT_HISTORY_KEY);
    if (!stored) return [];
    const history = JSON.parse(stored);
    const filtered = history.filter(item => item.projectId !== projectId);
    localStorage.setItem(EXPORT_HISTORY_KEY, JSON.stringify(filtered));
    return [];
  } catch {
    return [];
  }
}

/**
 * Format relative time (e.g., "2 hours ago", "Yesterday").
 */
function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay} days ago`;
  return date.toLocaleDateString();
}

/**
 * Map export status to stage header status format.
 */
function mapExportStatus(status) {
  const statusMap = {
    not_exported: 'empty',
    exported: 'complete',
  };
  return statusMap[status] || 'empty';
}

/**
 * Map export status to human-readable label.
 */
function getStatusLabel(status) {
  const labelMap = {
    not_exported: 'Not Exported',
    exported: 'Exported',
  };
  return labelMap[status] || 'Not Exported';
}

/**
 * Section metadata for requirements formatting.
 */
const SECTION_CONFIG = {
  problems: { label: 'Problems' },
  user_goals: { label: 'User Goals' },
  functional_requirements: { label: 'Functional Requirements' },
  data_needs: { label: 'Data Needs' },
  constraints: { label: 'Constraints' },
  non_goals: { label: 'Non-Goals' },
  risks_assumptions: { label: 'Risks & Assumptions' },
  open_questions: { label: 'Open Questions' },
  action_items: { label: 'Action Items' },
};

/**
 * Convert requirements data to Markdown format.
 */
function requirementsToMarkdown(requirements, projectName) {
  const lines = [`# ${projectName} - Requirements\n`];

  Object.entries(requirements).forEach(([section, items]) => {
    if (items && items.length > 0) {
      const sectionLabel = SECTION_CONFIG[section]?.label || section;
      lines.push(`## ${sectionLabel}\n`);
      items.forEach(item => {
        lines.push(`- ${item.content}`);
      });
      lines.push('');
    }
  });

  return lines.join('\n');
}

/**
 * Convert PRD sections to Markdown format.
 */
function prdToMarkdown(prd) {
  const lines = [`# ${prd.title || 'Product Requirements Document'}\n`];

  if (prd.sections && prd.sections.length > 0) {
    prd.sections.forEach(section => {
      if (section.title) {
        lines.push(`## ${section.title}\n`);
      }
      if (section.content) {
        lines.push(section.content);
        lines.push('');
      }
    });
  }

  return lines.join('\n');
}

/**
 * Convert user stories to Markdown format.
 */
function storiesToMarkdown(stories, projectName) {
  const lines = [`# ${projectName} - User Stories\n`];

  stories.forEach(story => {
    lines.push(`## ${story.story_id}: ${story.title}\n`);
    lines.push(story.description);
    lines.push('');

    // Add metadata badges
    const badges = [];
    if (story.size) badges.push(`**Size:** ${story.size.toUpperCase()}`);
    if (story.priority) badges.push(`**Priority:** ${story.priority}`);
    if (badges.length > 0) {
      lines.push(badges.join(' | '));
      lines.push('');
    }

    // Add acceptance criteria
    if (story.acceptance_criteria?.length > 0) {
      lines.push('### Acceptance Criteria\n');
      story.acceptance_criteria.forEach(criterion => {
        lines.push(`- [ ] ${criterion}`);
      });
      lines.push('');
    }

    // Add labels
    if (story.labels?.length > 0) {
      lines.push(`**Labels:** ${story.labels.join(', ')}`);
      lines.push('');
    }

    lines.push('---\n');
  });

  return lines.join('\n');
}

/**
 * Trigger a file download in the browser.
 */
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate a safe filename slug from project name.
 */
function slugifyFilename(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-_]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'project';
}

/**
 * Export stage content component.
 * Shows export options for project data in various formats.
 */
function ExportStage({ project }) {
  const [selectedItems, setSelectedItems] = useState({
    requirements: true,
    prd: true,
    stories: true,
  });
  const [selectedJsonItems, setSelectedJsonItems] = useState({
    requirements: true,
    prd: true,
    stories: true,
  });
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingJson, setIsExportingJson] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [jsonExportError, setJsonExportError] = useState(null);
  const [exportHistory, setExportHistory] = useState([]);

  // Load export history on mount
  useEffect(() => {
    if (project?.id) {
      setExportHistory(getExportHistory(project.id));
    }
  }, [project?.id]);

  const handleClearHistory = useCallback(() => {
    if (project?.id) {
      clearExportHistory(project.id);
      setExportHistory([]);
    }
  }, [project?.id]);

  const handleCheckboxChange = (itemId) => {
    setSelectedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
    setExportError(null);
  };

  const handleJsonCheckboxChange = (itemId) => {
    setSelectedJsonItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
    setJsonExportError(null);
  };

  const hasSelectedItems = Object.values(selectedItems).some(Boolean);
  const hasSelectedJsonItems = Object.values(selectedJsonItems).some(Boolean);

  const handleMarkdownExport = async () => {
    if (!project?.id || !hasSelectedItems) return;

    setIsExporting(true);
    setExportError(null);

    try {
      const zip = new JSZip();
      const projectSlug = slugifyFilename(project.name);

      // Fetch and add selected items to ZIP
      if (selectedItems.requirements) {
        try {
          const requirements = await get(`/api/projects/${project.id}/requirements`);
          const markdown = requirementsToMarkdown(requirements, project.name);
          zip.file('requirements.md', markdown);
        } catch (err) {
          console.warn('Could not fetch requirements:', err.message);
        }
      }

      if (selectedItems.prd) {
        try {
          const prdsResponse = await listPRDs(project.id, { limit: 1 });
          if (prdsResponse.items && prdsResponse.items.length > 0) {
            const latestPrd = prdsResponse.items[0];
            const markdown = prdToMarkdown(latestPrd);
            zip.file('prd.md', markdown);
          }
        } catch (err) {
          console.warn('Could not fetch PRD:', err.message);
        }
      }

      if (selectedItems.stories) {
        try {
          const storiesResponse = await listStories(project.id, { limit: 100 });
          if (storiesResponse.items && storiesResponse.items.length > 0) {
            const markdown = storiesToMarkdown(storiesResponse.items, project.name);
            zip.file('user-stories.md', markdown);
          }
        } catch (err) {
          console.warn('Could not fetch stories:', err.message);
        }
      }

      // Check if any files were added
      const files = Object.keys(zip.files);
      if (files.length === 0) {
        setExportError('No data available to export. Generate some content first.');
        return;
      }

      // Generate and download ZIP
      const blob = await zip.generateAsync({ type: 'blob' });
      const date = new Date().toISOString().split('T')[0];
      const filename = `${projectSlug}-export-${date}.zip`;
      triggerDownload(blob, filename);

      // Save to export history
      const includedItems = Object.entries(selectedItems)
        .filter(([, selected]) => selected)
        .map(([key]) => key);
      const historyEntry = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        projectId: project.id,
        type: 'markdown',
        filename,
        items: includedItems,
        date: new Date().toISOString(),
      };
      const updatedHistory = saveExportEntry(historyEntry);
      setExportHistory(updatedHistory);

    } catch (err) {
      console.error('Export failed:', err);
      setExportError(err.message || 'Failed to export project data');
    } finally {
      setIsExporting(false);
    }
  };

  const handleJsonExport = async () => {
    if (!project?.id || !hasSelectedJsonItems) return;

    setIsExportingJson(true);
    setJsonExportError(null);

    try {
      const exportData = {
        exportedAt: new Date().toISOString(),
        project: {
          id: project.id,
          name: project.name,
        },
      };

      // Fetch selected items
      if (selectedJsonItems.requirements) {
        try {
          const requirements = await get(`/api/projects/${project.id}/requirements`);
          exportData.requirements = requirements;
        } catch (err) {
          console.warn('Could not fetch requirements:', err.message);
        }
      }

      if (selectedJsonItems.prd) {
        try {
          const prdsResponse = await listPRDs(project.id, { limit: 1 });
          if (prdsResponse.items && prdsResponse.items.length > 0) {
            exportData.prd = prdsResponse.items[0];
          }
        } catch (err) {
          console.warn('Could not fetch PRD:', err.message);
        }
      }

      if (selectedJsonItems.stories) {
        try {
          const storiesResponse = await listStories(project.id, { limit: 100 });
          if (storiesResponse.items && storiesResponse.items.length > 0) {
            exportData.stories = storiesResponse.items;
          }
        } catch (err) {
          console.warn('Could not fetch stories:', err.message);
        }
      }

      // Check if any data was fetched
      const hasData = exportData.requirements || exportData.prd || exportData.stories;
      if (!hasData) {
        setJsonExportError('No data available to export. Generate some content first.');
        return;
      }

      // Generate and download JSON
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const projectSlug = slugifyFilename(project.name);
      const date = new Date().toISOString().split('T')[0];
      const filename = `${projectSlug}-export-${date}.json`;
      triggerDownload(blob, filename);

      // Save to export history
      const includedItems = Object.entries(selectedJsonItems)
        .filter(([, selected]) => selected)
        .map(([key]) => key);
      const historyEntry = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        projectId: project.id,
        type: 'json',
        filename,
        items: includedItems,
        date: new Date().toISOString(),
      };
      const updatedHistory = saveExportEntry(historyEntry);
      setExportHistory(updatedHistory);

    } catch (err) {
      console.error('JSON export failed:', err);
      setJsonExportError(err.message || 'Failed to export project data');
    } finally {
      setIsExportingJson(false);
    }
  };

  const exportCheckboxes = [
    { id: 'requirements', label: 'Requirements', description: 'Extracted requirements organized by section' },
    { id: 'prd', label: 'PRD', description: 'Product Requirements Document' },
    { id: 'stories', label: 'User Stories', description: 'Generated user stories with acceptance criteria' },
  ];

  const integrationCards = [
    {
      id: 'jira',
      title: 'Jira Integration',
      description: 'Export user stories directly to your Jira project as issues.',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      color: 'jira',
      comingSoon: true,
    },
  ];

  return (
    <div className="stage-content stage-content--export">
      <StageHeader
        title="Export"
        subtitle="Download your project data or integrate with external tools"
        status={mapExportStatus(project?.export_status)}
        statusLabel={getStatusLabel(project?.export_status)}
      />

      {/* Export Options Section */}
      <section className="export-stage__section">
        <h2 className="export-stage__section-title">Download Options</h2>

        {/* Markdown Export Card with Checkboxes */}
        <div className="export-card export-card--green export-card--expanded">
          <div className="export-card__header">
            <div className="export-card__icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 13H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M8 17H12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="export-card__content">
              <h3 className="export-card__title">Export as Markdown</h3>
              <p className="export-card__description">Select items to include in your ZIP archive.</p>
            </div>
          </div>

          {/* Checkboxes */}
          <div className="export-card__checkboxes">
            {exportCheckboxes.map(item => (
              <label key={item.id} className="export-checkbox">
                <input
                  type="checkbox"
                  checked={selectedItems[item.id]}
                  onChange={() => handleCheckboxChange(item.id)}
                  disabled={isExporting}
                />
                <span className="export-checkbox__checkmark" />
                <span className="export-checkbox__text">
                  <span className="export-checkbox__label">{item.label}</span>
                  <span className="export-checkbox__description">{item.description}</span>
                </span>
              </label>
            ))}
          </div>

          {/* Error message */}
          {exportError && (
            <div className="export-card__error">
              {exportError}
            </div>
          )}

          {/* Export Button */}
          <button
            className="export-card__button"
            onClick={handleMarkdownExport}
            disabled={!hasSelectedItems || isExporting}
            type="button"
          >
            {isExporting ? (
              <>
                <span className="export-card__spinner" />
                Exporting...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 2.5V10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M4.5 7L8 10.5L11.5 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2.5 13.5H13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Download ZIP
              </>
            )}
          </button>
        </div>

        {/* JSON Export Card */}
        <div className="export-card export-card--blue export-card--expanded" style={{ marginTop: '1rem' }}>
          <div className="export-card__header">
            <div className="export-card__icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 18L22 12L16 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 6L2 12L8 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="export-card__content">
              <h3 className="export-card__title">Export as JSON</h3>
              <p className="export-card__description">Select items to include in your JSON export.</p>
            </div>
          </div>

          {/* Checkboxes */}
          <div className="export-card__checkboxes">
            {exportCheckboxes.map(item => (
              <label key={item.id} className="export-checkbox export-checkbox--blue">
                <input
                  type="checkbox"
                  checked={selectedJsonItems[item.id]}
                  onChange={() => handleJsonCheckboxChange(item.id)}
                  disabled={isExportingJson}
                />
                <span className="export-checkbox__checkmark export-checkbox__checkmark--blue" />
                <span className="export-checkbox__text">
                  <span className="export-checkbox__label">{item.label}</span>
                  <span className="export-checkbox__description">{item.description}</span>
                </span>
              </label>
            ))}
          </div>

          {/* Error message */}
          {jsonExportError && (
            <div className="export-card__error">
              {jsonExportError}
            </div>
          )}

          {/* Export Button */}
          <button
            className="export-card__button export-card__button--blue"
            onClick={handleJsonExport}
            disabled={!hasSelectedJsonItems || isExportingJson}
            type="button"
          >
            {isExportingJson ? (
              <>
                <span className="export-card__spinner" />
                Exporting...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 2.5V10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M4.5 7L8 10.5L11.5 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2.5 13.5H13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Download JSON
              </>
            )}
          </button>
        </div>
      </section>

      {/* Integrations Section */}
      <section className="export-stage__section">
        <h2 className="export-stage__section-title">Integrations</h2>
        <div className="export-stage__cards">
          {integrationCards.map((card) => (
            <div
              key={card.id}
              className={`export-card export-card--${card.color} ${card.comingSoon ? 'export-card--disabled' : ''}`}
            >
              <div className="export-card__icon">
                {card.icon}
              </div>
              <div className="export-card__content">
                <h3 className="export-card__title">
                  {card.title}
                  {card.comingSoon && (
                    <span className="export-card__badge">Coming Soon</span>
                  )}
                </h3>
                <p className="export-card__description">{card.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Export History Section */}
      <section className="export-stage__section">
        <div className="export-history__header">
          <h2 className="export-stage__section-title">Export History</h2>
          {exportHistory.length > 0 && (
            <button
              type="button"
              className="export-history__clear-btn"
              onClick={handleClearHistory}
            >
              Clear History
            </button>
          )}
        </div>
        {exportHistory.length === 0 ? (
          <div className="export-history__empty">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
              <path d="M12 6V12L16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <p>No exports yet. Your export history will appear here.</p>
          </div>
        ) : (
          <ul className="export-history__list">
            {exportHistory.map((entry) => (
              <li key={entry.id} className="export-history__item">
                <div className="export-history__icon">
                  {entry.type === 'markdown' ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M16 18L22 12L16 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M8 6L2 12L8 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <div className="export-history__details">
                  <span className="export-history__filename">{entry.filename}</span>
                  <span className="export-history__meta">
                    {entry.type === 'markdown' ? 'Markdown ZIP' : 'JSON'} • {entry.items.join(', ')} • {formatRelativeTime(entry.date)}
                  </span>
                </div>
                <span className={`export-history__badge export-history__badge--${entry.type === 'markdown' ? 'green' : 'blue'}`}>
                  {entry.type === 'markdown' ? 'MD' : 'JSON'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default ExportStage;
