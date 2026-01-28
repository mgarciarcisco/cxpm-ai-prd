import React, { useState, useEffect, useCallback, useRef } from 'react';
import Markdown from 'react-markdown';
import { EmptyState } from '../common/EmptyState';
import { StageActions } from '../stage/StageActions';
import GeneratePRDModal from '../prd/GeneratePRDModal';
import VersionHistory from '../prd/VersionHistory';
import { usePRDStreamingV2, SectionStatus } from '../../hooks/usePRDStreamingV2';
import { getPRD, updatePRD, listPRDs, patch } from '../../services/api';
import './StageContent.css';
import './PRDStage.css';

const DEBOUNCE_DELAY_MS = 1000;

/**
 * PRD stage content component.
 * Shows empty state when no PRD exists, with options to generate from requirements or write manually.
 * Shows warning if requirements are not yet reviewed.
 * Supports section-by-section streaming during PRD generation.
 */
/**
 * Format a relative time string (e.g., "2 minutes ago", "just now")
 */
function formatTimeAgo(date) {
  if (!date) return '';
  const now = new Date();
  const then = new Date(date);
  const diffMs = now - then;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
}

function PRDStage({ project, onProjectUpdate }) {
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationMode, setGenerationMode] = useState(null);

  // View/Edit state
  const [activeTab, setActiveTab] = useState('preview'); // 'preview' or 'edit'
  const [prdData, setPrdData] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [loadingPRD, setLoadingPRD] = useState(false);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved', 'saving', 'unsaved', 'error'
  const [lastUpdated, setLastUpdated] = useState(null);

  // Refs for debounce
  const saveTimeoutRef = useRef(null);

  // Mark as Ready state
  const [markingAsReady, setMarkingAsReady] = useState(false);

  // Version preview state
  const [previewVersion, setPreviewVersion] = useState(null);

  // Use the PRD streaming hook
  const {
    getSortedSections,
    getCompletedCount,
    getTotalCount,
    status: streamStatus,
    error: streamError,
    retry,
    prdId: streamPrdId,
  } = usePRDStreamingV2(project?.id, generationMode, isGenerating);

  // Check if PRD exists (prd_status !== 'empty')
  const hasPRD = project?.prd_status && project.prd_status !== 'empty';

  // Check if requirements are complete (reviewed)
  const requirementsComplete = project?.requirements_status === 'reviewed';

  // Load PRD data from API
  const loadPRDData = useCallback(async () => {
    try {
      setLoadingPRD(true);
      // Get the latest PRD for this project
      const prdsResponse = await listPRDs(project.id, { limit: 1 });
      if (prdsResponse.items && prdsResponse.items.length > 0) {
        const latestPrd = prdsResponse.items[0];
        // Fetch full PRD with content
        const fullPrd = await getPRD(latestPrd.id);
        setPrdData(fullPrd);
        setEditContent(fullPrd.raw_markdown || '');
        setLastUpdated(fullPrd.updated_at);
        setSaveStatus('saved');
      }
    } catch (err) {
      console.error('Failed to load PRD:', err);
    } finally {
      setLoadingPRD(false);
    }
  }, [project?.id]);

  // Load PRD data when component mounts or PRD exists
  useEffect(() => {
    if (hasPRD && project?.id && !isGenerating) {
      loadPRDData();
    }
    // Cleanup timeout on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [hasPRD, project?.id, isGenerating, loadPRDData]);

  // Handle stream completion
  useEffect(() => {
    if (streamStatus === 'complete' || streamStatus === 'partial') {
      setIsGenerating(false);
      // Refresh project data to update prd_status
      if (onProjectUpdate) {
        onProjectUpdate();
      }
      // Load the newly generated PRD
      if (streamPrdId) {
        loadPRDFromId(streamPrdId);
      }
    }
  }, [streamStatus, onProjectUpdate, streamPrdId]);

  // Load PRD from a specific ID (used after generation)
  const loadPRDFromId = async (prdId) => {
    try {
      setLoadingPRD(true);
      const fullPrd = await getPRD(prdId);
      setPrdData(fullPrd);
      setEditContent(fullPrd.raw_markdown || '');
      setLastUpdated(fullPrd.updated_at);
      setSaveStatus('saved');
    } catch (err) {
      console.error('Failed to load generated PRD:', err);
    } finally {
      setLoadingPRD(false);
    }
  };

  // Handle stream error
  useEffect(() => {
    if (streamStatus === 'error') {
      setIsGenerating(false);
    }
  }, [streamStatus]);

  // PRD document icon
  const prdIcon = (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 8H36C38.2091 8 40 9.79086 40 12V36C40 38.2091 38.2091 40 36 40H12C9.79086 40 8 38.2091 8 36V12C8 9.79086 9.79086 8 12 8Z" stroke="currentColor" strokeWidth="2"/>
      <path d="M16 16H32" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M16 22H32" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M16 28H26" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M16 34H22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );

  // Warning icon for incomplete requirements
  const warningIcon = (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 5.5V8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="8" cy="11" r="0.75" fill="currentColor"/>
      <path d="M6.86 2.573L1.215 12.427C.77 13.2 1.322 14.167 2.216 14.167h11.568c.894 0 1.446-.966 1.001-1.74L9.14 2.573c-.44-.765-1.54-.765-1.98 0z" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );

  // Open the generate modal
  const handleGenerateFromReqs = () => {
    setShowGenerateModal(true);
  };

  // Handle generation start from modal
  const handleGenerate = useCallback((mode) => {
    setShowGenerateModal(false);
    setGenerationMode(mode);
    setIsGenerating(true);
  }, []);

  const handleWriteManually = () => {
    console.log('Write PRD manually');
    // TODO: Open PRD editor directly (P3-027)
  };

  const handleRetry = () => {
    retry();
  };

  // Parse markdown content into sections for API update
  const parseMarkdownToSections = (markdown) => {
    // Split by ## headers to extract sections
    const lines = markdown.split('\n');
    const sections = [];
    let currentSection = null;
    let contentLines = [];

    for (const line of lines) {
      const headerMatch = line.match(/^##\s+(.+)/);
      if (headerMatch) {
        // Save previous section if exists
        if (currentSection) {
          sections.push({
            title: currentSection,
            content: contentLines.join('\n').trim()
          });
        }
        currentSection = headerMatch[1];
        contentLines = [];
      } else if (currentSection) {
        contentLines.push(line);
      }
    }

    // Save last section
    if (currentSection) {
      sections.push({
        title: currentSection,
        content: contentLines.join('\n').trim()
      });
    }

    // If no sections were parsed, treat entire content as one section
    if (sections.length === 0 && markdown.trim()) {
      sections.push({
        title: 'Content',
        content: markdown.trim()
      });
    }

    return sections;
  };

  // Auto-save PRD content with debounce
  const saveContent = useCallback(async (content) => {
    if (!prdData?.id) return;
    try {
      setSaveStatus('saving');
      // Parse markdown content to sections for API
      const sections = parseMarkdownToSections(content);
      const updatedPrd = await updatePRD(prdData.id, {
        title: prdData.title,
        sections: sections
      });
      // Update local PRD data with new sections
      setPrdData(prev => ({
        ...prev,
        sections: updatedPrd.sections,
        raw_markdown: updatedPrd.raw_markdown
      }));
      setLastUpdated(updatedPrd.updated_at || new Date().toISOString());
      setSaveStatus('saved');
    } catch (err) {
      console.error('Failed to save PRD:', err);
      setSaveStatus('error');
    }
  }, [prdData?.id, prdData?.title]);

  // Debounced save handler
  const debouncedSave = useCallback((content) => {
    setSaveStatus('unsaved');
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveContent(content);
    }, DEBOUNCE_DELAY_MS);
  }, [saveContent]);

  // Handle edit content change
  const handleEditChange = (e) => {
    const newContent = e.target.value;
    setEditContent(newContent);
    debouncedSave(newContent);
  };

  // Handle blur - save immediately if there are unsaved changes
  const handleEditBlur = () => {
    if (saveStatus === 'unsaved' && prdData?.id) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveContent(editContent);
    }
  };

  // Handle Mark as Ready - updates prd_status to 'ready'
  const handleMarkAsReady = async () => {
    if (!project?.id) return;

    try {
      setMarkingAsReady(true);
      await patch(`/api/projects/${project.id}/stages/prd`, { status: 'ready' });
      // Notify parent to refresh project data
      if (onProjectUpdate) {
        onProjectUpdate();
      }
    } catch (err) {
      console.error('Failed to mark as ready:', err);
    } finally {
      setMarkingAsReady(false);
    }
  };

  // Handle version preview - when a historical version is loaded
  const handleVersionLoad = useCallback((versionData) => {
    setPreviewVersion(versionData);
    setActiveTab('preview'); // Switch to preview mode when viewing old version
  }, []);

  // Handle returning to current version
  const handleReturnToCurrent = useCallback(() => {
    setPreviewVersion(null);
  }, []);

  // Determine if PRD is already ready
  const isReady = project?.prd_status === 'ready';

  // Get sorted sections for rendering
  const sortedSections = getSortedSections();
  const completedCount = getCompletedCount();
  const totalCount = getTotalCount();

  // Show generation view when generating
  if (isGenerating || (sortedSections.length > 0 && streamStatus !== 'complete' && streamStatus !== 'partial' && streamStatus !== 'error')) {
    return (
      <div className="stage-content stage-content--prd">
        <div className="prd-generation">
          {/* Progress indicator */}
          <div className="prd-generation__header">
            <div className="prd-generation__progress">
              <div className="prd-generation__spinner" />
              <span className="prd-generation__status">
                {totalCount > 0
                  ? `Generating... Section ${completedCount + 1} of ${totalCount}`
                  : 'Starting generation...'}
              </span>
            </div>
            <div className="prd-generation__mode">
              {generationMode === 'detailed' ? 'Detailed' : 'Brief'} PRD
            </div>
          </div>

          {/* Progress bar */}
          {totalCount > 0 && (
            <div className="prd-generation__progress-bar">
              <div
                className="prd-generation__progress-fill"
                style={{ width: `${(completedCount / totalCount) * 100}%` }}
              />
            </div>
          )}

          {/* Sections */}
          <div className="prd-generation__sections">
            {sortedSections.map((section) => (
              <div
                key={section.id}
                className={`prd-section prd-section--${section.status}`}
              >
                {/* Section header */}
                <div className="prd-section__header">
                  <span className="prd-section__status-icon">
                    {section.status === SectionStatus.COMPLETED && (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M13.5 4.5L6 12L2.5 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                    {section.status === SectionStatus.GENERATING && (
                      <div className="prd-section__spinner" />
                    )}
                    {section.status === SectionStatus.PENDING && (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2"/>
                      </svg>
                    )}
                    {section.status === SectionStatus.FAILED && (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    )}
                  </span>
                  <span className="prd-section__title">
                    {section.title || formatSectionId(section.id)}
                  </span>
                </div>

                {/* Section content - show for completed or generating sections */}
                {(section.status === SectionStatus.COMPLETED || section.status === SectionStatus.GENERATING) && section.content && (
                  <div className="prd-section__content">
                    <Markdown>{section.content}</Markdown>
                  </div>
                )}

                {/* Pending placeholder */}
                {section.status === SectionStatus.PENDING && (
                  <div className="prd-section__placeholder">
                    Waiting to generate...
                  </div>
                )}

                {/* Failed message */}
                {section.status === SectionStatus.FAILED && (
                  <div className="prd-section__error">
                    {section.error || 'Failed to generate this section'}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Show error state if generation failed
  if (streamStatus === 'error') {
    return (
      <div className="stage-content stage-content--prd">
        <div className="prd-error">
          <div className="prd-error__icon">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2"/>
              <path d="M24 14v12M24 30v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <h3 className="prd-error__title">Generation Failed</h3>
          <p className="prd-error__message">{streamError}</p>
          <div className="prd-error__actions">
            <button onClick={handleRetry}>Try Again</button>
            <button className="secondary" onClick={() => setIsGenerating(false)}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show completed PRD with Preview/Edit tabs
  if ((streamStatus === 'complete' || streamStatus === 'partial') && sortedSections.length > 0) {
    // Build markdown content from sections for display
    const combinedMarkdown = sortedSections
      .filter(s => s.status === SectionStatus.COMPLETED && s.content)
      .map(s => `## ${s.title || formatSectionId(s.id)}\n\n${s.content}`)
      .join('\n\n');

    // Determine which data to display (current or preview version)
    const isViewingOldVersion = previewVersion !== null;

    return (
      <div className="stage-content stage-content--prd">
        <div className="prd-viewer">
          {/* Version preview banner */}
          {isViewingOldVersion && (
            <div className="prd-viewer__version-banner">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>Viewing Version {previewVersion.version} from {formatTimeAgo(previewVersion.created_at)}</span>
              <button
                className="prd-viewer__version-banner-close"
                onClick={handleReturnToCurrent}
              >
                Return to Current
              </button>
            </div>
          )}

          {/* Header with tabs and version history */}
          <div className="prd-viewer__header">
            <div className="prd-viewer__header-left">
              <div className="prd-viewer__tabs">
                <button
                  className={`prd-viewer__tab ${activeTab === 'preview' ? 'prd-viewer__tab--active' : ''}`}
                  onClick={() => setActiveTab('preview')}
                >
                  Preview
                </button>
                <button
                  className={`prd-viewer__tab ${activeTab === 'edit' ? 'prd-viewer__tab--active' : ''}`}
                  onClick={() => {
                    if (isViewingOldVersion) {
                      handleReturnToCurrent();
                    }
                    setActiveTab('edit');
                  }}
                  disabled={isViewingOldVersion}
                  title={isViewingOldVersion ? 'Return to current version to edit' : undefined}
                >
                  Edit
                </button>
              </div>
              {/* Version History selector */}
              {prdData && (
                <VersionHistory
                  projectId={project?.id}
                  currentPrdId={prdData.id}
                  currentVersion={prdData.version}
                  onVersionLoad={handleVersionLoad}
                />
              )}
            </div>
            <div className="prd-viewer__meta">
              {streamStatus === 'partial' && !isViewingOldVersion && (
                <span className="prd-viewer__warning">
                  Some sections failed to generate
                </span>
              )}
              {!isViewingOldVersion && lastUpdated && (
                <span className="prd-viewer__timestamp">
                  Last edited {formatTimeAgo(lastUpdated)}
                </span>
              )}
              {activeTab === 'edit' && !isViewingOldVersion && (
                <span className={`prd-viewer__save-status prd-viewer__save-status--${saveStatus}`}>
                  {saveStatus === 'saving' && 'Saving...'}
                  {saveStatus === 'saved' && 'Saved'}
                  {saveStatus === 'unsaved' && 'Unsaved changes'}
                  {saveStatus === 'error' && 'Error saving'}
                </span>
              )}
            </div>
          </div>

          {/* Content area */}
          <div className="prd-viewer__content">
            {activeTab === 'preview' ? (
              <div className="prd-viewer__preview">
                {isViewingOldVersion ? (
                  // Show preview version content
                  previewVersion.sections && previewVersion.sections.length > 0 ? (
                    previewVersion.sections.map((section, index) => (
                      <div key={index} className="prd-section prd-section--completed">
                        <h2 className="prd-section__title">
                          {section.title || `Section ${index + 1}`}
                        </h2>
                        <div className="prd-section__content">
                          <Markdown>{section.content || ''}</Markdown>
                        </div>
                      </div>
                    ))
                  ) : previewVersion.raw_markdown ? (
                    <div className="prd-viewer__markdown">
                      <Markdown>{previewVersion.raw_markdown}</Markdown>
                    </div>
                  ) : (
                    <div className="prd-viewer__empty">
                      No content in this version.
                    </div>
                  )
                ) : (
                  // Show current streamed content
                  sortedSections.map((section) => (
                    <div
                      key={section.id}
                      className={`prd-section prd-section--${section.status}`}
                    >
                      <h2 className="prd-section__title">
                        {section.title || formatSectionId(section.id)}
                      </h2>
                      {section.status === SectionStatus.COMPLETED && section.content && (
                        <div className="prd-section__content">
                          <Markdown>{section.content}</Markdown>
                        </div>
                      )}
                      {section.status === SectionStatus.FAILED && (
                        <div className="prd-section__error">
                          {section.error || 'Failed to generate this section'}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            ) : (
              <textarea
                className="prd-viewer__editor"
                value={editContent || combinedMarkdown}
                onChange={handleEditChange}
                onBlur={handleEditBlur}
                placeholder="Write your PRD content in Markdown..."
              />
            )}
          </div>
        </div>

        {/* Stage Actions */}
        <StageActions
          primaryAction={
            isReady
              ? { label: 'Ready', onClick: () => {}, disabled: true }
              : { label: 'Mark as Ready', onClick: handleMarkAsReady, loading: markingAsReady, disabled: isViewingOldVersion }
          }
        />
      </div>
    );
  }

  // Empty state - no PRD yet
  if (!hasPRD) {
    return (
      <div className="stage-content stage-content--prd">
        {/* Warning banner if requirements not complete */}
        {!requirementsComplete && (
          <div className="prd-stage__warning">
            <span className="prd-stage__warning-icon">{warningIcon}</span>
            <span className="prd-stage__warning-text">
              Requirements are not yet reviewed. Consider reviewing requirements before generating a PRD.
            </span>
          </div>
        )}

        <EmptyState
          icon={prdIcon}
          title="No PRD generated yet"
          description="Generate a detailed PRD from your requirements or write one manually."
          actions={[
            <button
              key="generate"
              onClick={handleGenerateFromReqs}
              disabled={!requirementsComplete}
              title={!requirementsComplete ? 'Review requirements first' : undefined}
            >
              Generate from Reqs
            </button>,
            <button
              key="manual"
              className="secondary"
              onClick={handleWriteManually}
            >
              Write Manually
            </button>
          ]}
        />

        {/* Generate PRD Modal */}
        {showGenerateModal && (
          <GeneratePRDModal
            projectId={project?.id}
            onClose={() => setShowGenerateModal(false)}
            onGenerate={handleGenerate}
          />
        )}
      </div>
    );
  }

  // PRD exists - show with Preview/Edit tabs
  if (loadingPRD) {
    return (
      <div className="stage-content stage-content--prd">
        <div className="prd-loading">
          <div className="prd-loading__spinner" />
          <span className="prd-loading__text">Loading PRD...</span>
        </div>
      </div>
    );
  }

  if (prdData) {
    // Determine which data to display (current or preview version)
    const displayData = previewVersion || prdData;
    const isViewingOldVersion = previewVersion !== null;

    return (
      <div className="stage-content stage-content--prd">
        <div className="prd-viewer">
          {/* Version preview banner */}
          {isViewingOldVersion && (
            <div className="prd-viewer__version-banner">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>Viewing Version {previewVersion.version} from {formatTimeAgo(previewVersion.created_at)}</span>
              <button
                className="prd-viewer__version-banner-close"
                onClick={handleReturnToCurrent}
              >
                Return to Current
              </button>
            </div>
          )}

          {/* Header with tabs and version history */}
          <div className="prd-viewer__header">
            <div className="prd-viewer__header-left">
              <div className="prd-viewer__tabs">
                <button
                  className={`prd-viewer__tab ${activeTab === 'preview' ? 'prd-viewer__tab--active' : ''}`}
                  onClick={() => setActiveTab('preview')}
                >
                  Preview
                </button>
                <button
                  className={`prd-viewer__tab ${activeTab === 'edit' ? 'prd-viewer__tab--active' : ''}`}
                  onClick={() => {
                    if (isViewingOldVersion) {
                      handleReturnToCurrent();
                    }
                    setActiveTab('edit');
                  }}
                  disabled={isViewingOldVersion}
                  title={isViewingOldVersion ? 'Return to current version to edit' : undefined}
                >
                  Edit
                </button>
              </div>
              {/* Version History selector */}
              <VersionHistory
                projectId={project?.id}
                currentPrdId={prdData.id}
                currentVersion={prdData.version}
                onVersionLoad={handleVersionLoad}
              />
            </div>
            <div className="prd-viewer__meta">
              {!isViewingOldVersion && lastUpdated && (
                <span className="prd-viewer__timestamp">
                  Last edited {formatTimeAgo(lastUpdated)}
                </span>
              )}
              {activeTab === 'edit' && !isViewingOldVersion && (
                <span className={`prd-viewer__save-status prd-viewer__save-status--${saveStatus}`}>
                  {saveStatus === 'saving' && 'Saving...'}
                  {saveStatus === 'saved' && 'Saved'}
                  {saveStatus === 'unsaved' && 'Unsaved changes'}
                  {saveStatus === 'error' && 'Error saving'}
                </span>
              )}
            </div>
          </div>

          {/* Content area */}
          <div className="prd-viewer__content">
            {activeTab === 'preview' ? (
              <div className="prd-viewer__preview">
                {displayData.sections && displayData.sections.length > 0 ? (
                  displayData.sections.map((section, index) => (
                    <div key={index} className="prd-section prd-section--completed">
                      <h2 className="prd-section__title">
                        {section.title || `Section ${index + 1}`}
                      </h2>
                      <div className="prd-section__content">
                        <Markdown>{section.content || ''}</Markdown>
                      </div>
                    </div>
                  ))
                ) : displayData.raw_markdown ? (
                  <div className="prd-viewer__markdown">
                    <Markdown>{displayData.raw_markdown}</Markdown>
                  </div>
                ) : (
                  <div className="prd-viewer__empty">
                    No content yet. Switch to Edit tab to add content.
                  </div>
                )}
              </div>
            ) : (
              <textarea
                className="prd-viewer__editor"
                value={editContent}
                onChange={handleEditChange}
                onBlur={handleEditBlur}
                placeholder="Write your PRD content in Markdown..."
              />
            )}
          </div>
        </div>

        {/* Stage Actions */}
        <StageActions
          primaryAction={
            isReady
              ? { label: 'Ready', onClick: () => {}, disabled: true }
              : { label: 'Mark as Ready', onClick: handleMarkAsReady, loading: markingAsReady, disabled: isViewingOldVersion }
          }
        />
      </div>
    );
  }

  // Fallback loading state
  return (
    <div className="stage-content stage-content--prd">
      <div className="prd-loading">
        <div className="prd-loading__spinner" />
        <span className="prd-loading__text">Loading PRD...</span>
      </div>
    </div>
  );
}

/**
 * Format a section ID into a readable title
 * e.g., 'problem_statement' -> 'Problem Statement'
 */
function formatSectionId(sectionId) {
  if (!sectionId) return 'Section';
  return sectionId
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default PRDStage;
