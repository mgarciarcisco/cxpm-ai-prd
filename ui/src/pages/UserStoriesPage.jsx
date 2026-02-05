import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { get, listStories, deleteStory, updateStory } from '../services/api'
import { useStoriesStreaming } from '../hooks/useStoriesStreaming'
import LoadingSpinner from '../components/common/LoadingSpinner'
import { Breadcrumbs } from '../components/common/Breadcrumbs'
import StoryCard from '../components/stories/StoryCard'
import StoryEditModal from '../components/stories/StoryEditModal'
import StoriesExportModal from '../components/stories/StoriesExportModal'
import StoryBatchFilter from '../components/stories/StoryBatchFilter'
import './UserStoriesPage.css'

const COOLDOWN_DURATION_MS = 30000

// Section options for filtering (from backend Section enum)
const SECTION_OPTIONS = [
  { id: 'problems', label: 'Problems' },
  { id: 'user_goals', label: 'User Goals' },
  { id: 'functional_requirements', label: 'Functional Requirements' },
  { id: 'data_needs', label: 'Data Needs' },
  { id: 'constraints', label: 'Constraints' },
  { id: 'non_goals', label: 'Non-Goals' },
  { id: 'risks_assumptions', label: 'Risks & Assumptions' },
  { id: 'open_questions', label: 'Open Questions' },
  { id: 'action_items', label: 'Action Items' },
]

// Format options with descriptions
const FORMAT_OPTIONS = [
  {
    id: 'classic',
    title: 'Classic Format',
    description: '"As a [user], I want [goal], so that [benefit]" - the standard user story format focused on personas.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
  {
    id: 'job_story',
    title: 'Job Story Format',
    description: '"When [situation], I want to [action], so I can [outcome]" - focuses on context and motivation.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
  },
]

function UserStoriesPage() {
  const { projectId } = useParams()

  // Project info
  const [project, setProject] = useState(null)
  const [loadingProject, setLoadingProject] = useState(true)
  const [projectError, setProjectError] = useState(null)

  // Generation state
  const [selectedFormat, setSelectedFormat] = useState('classic')
  const [selectedSections, setSelectedSections] = useState([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [localError, setLocalError] = useState(null)

  // Stories list
  const [stories, setStories] = useState([])
  const [loadingStories, setLoadingStories] = useState(false)
  const [filterBatchId, setFilterBatchId] = useState(null)

  // Cooldown state
  const [cooldownUntil, setCooldownUntil] = useState(null)
  const [cooldownRemaining, setCooldownRemaining] = useState(0)

  // Info dialog state
  const [showInfoDialog, setShowInfoDialog] = useState(false)
  const [showSectionFilter, setShowSectionFilter] = useState(false)

  // Edit modal state
  const [editingStory, setEditingStory] = useState(null)
  const [isSavingStory, setIsSavingStory] = useState(false)

  // Export modal state
  const [showExportModal, setShowExportModal] = useState(false)

  // Refs for cleanup
  const cooldownIntervalRef = useRef(null)
  const sectionFilterRef = useRef(null)

  // Use streaming hook for story generation
  const {
    stories: streamingStories,
    status: streamingStatus,
    error: streamingError,
    batchId,
  } = useStoriesStreaming(projectId, selectedFormat, selectedSections, isGenerating)

  // Handle streaming completion - refresh stories list
  useEffect(() => {
    if (streamingStatus === 'complete' && batchId) {
      setIsGenerating(false)
      fetchStories()
    }
  }, [streamingStatus, batchId])

  // Handle streaming error
  useEffect(() => {
    if (streamingStatus === 'error' && streamingError) {
      setIsGenerating(false)
      setLocalError(streamingError)
    }
  }, [streamingStatus, streamingError])

  // Fetch project info on mount
  useEffect(() => {
    fetchProject()
  }, [projectId])

  // Fetch stories when projectId or filterBatchId changes
  useEffect(() => {
    fetchStories()
  }, [projectId, filterBatchId])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cooldownIntervalRef.current) {
        clearInterval(cooldownIntervalRef.current)
      }
    }
  }, [])

  // Handle cooldown timer
  useEffect(() => {
    if (cooldownUntil) {
      const updateCooldown = () => {
        const remaining = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000))
        setCooldownRemaining(remaining)
        if (remaining <= 0) {
          setCooldownUntil(null)
          if (cooldownIntervalRef.current) {
            clearInterval(cooldownIntervalRef.current)
            cooldownIntervalRef.current = null
          }
        }
      }
      updateCooldown()
      cooldownIntervalRef.current = setInterval(updateCooldown, 1000)
      return () => {
        if (cooldownIntervalRef.current) {
          clearInterval(cooldownIntervalRef.current)
          cooldownIntervalRef.current = null
        }
      }
    }
  }, [cooldownUntil])

  // Handle click outside for section filter dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sectionFilterRef.current && !sectionFilterRef.current.contains(e.target)) {
        setShowSectionFilter(false)
      }
    }
    if (showSectionFilter) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showSectionFilter])

  const fetchProject = async () => {
    try {
      setLoadingProject(true)
      setProjectError(null)
      const data = await get(`/api/projects/${projectId}`)
      setProject(data)
    } catch (err) {
      setProjectError(err.message)
    } finally {
      setLoadingProject(false)
    }
  }

  const fetchStories = async () => {
    try {
      setLoadingStories(true)
      const options = { limit: 100 }
      if (filterBatchId) {
        options.batch_id = filterBatchId
      }
      const data = await listStories(projectId, options)
      setStories(data.items || data || [])
    } catch (err) {
      // Silently fail for stories list - not critical
      console.error('Failed to fetch stories:', err)
    } finally {
      setLoadingStories(false)
    }
  }

  const handleGenerate = () => {
    // Show info dialog first if there are existing stories
    if (stories.length > 0 && !showInfoDialog) {
      setShowInfoDialog(true)
      return
    }

    setShowInfoDialog(false)
    setLocalError(null)
    setIsGenerating(true)

    // Start cooldown
    setCooldownUntil(Date.now() + COOLDOWN_DURATION_MS)
  }

  const handleConfirmGenerate = () => {
    setShowInfoDialog(false)
    setLocalError(null)
    setIsGenerating(true)

    // Start cooldown
    setCooldownUntil(Date.now() + COOLDOWN_DURATION_MS)
  }

  const handleCancelDialog = () => {
    setShowInfoDialog(false)
  }

  const handleCancel = () => {
    // Stop the streaming connection by setting isGenerating to false
    setIsGenerating(false)
  }

  const handleRetry = () => {
    setLocalError(null)
    // Don't reset cooldown - let it continue if active
  }

  // Combined error from streaming or local
  const error = localError || streamingError

  const handleEditStory = (story) => {
    setEditingStory(story)
  }

  const handleSaveStory = async (storyId, data) => {
    try {
      setIsSavingStory(true)
      await updateStory(storyId, data)
      // Close modal and refresh list
      setEditingStory(null)
      fetchStories()
    } catch (err) {
      console.error('Failed to save story:', err)
      // Keep modal open on error so user can retry
      throw err
    } finally {
      setIsSavingStory(false)
    }
  }

  const handleCloseEditModal = () => {
    setEditingStory(null)
  }

  const handleDeleteStory = async (storyId) => {
    await deleteStory(storyId)
    // Refresh the stories list after deletion
    fetchStories()
  }

  const handleBatchFilterChange = (batchId) => {
    setFilterBatchId(batchId)
  }

  const handleBatchDeleted = () => {
    // Refresh stories list after batch deletion
    fetchStories()
  }

  const toggleSection = (sectionId) => {
    setSelectedSections((prev) => {
      if (prev.includes(sectionId)) {
        return prev.filter((id) => id !== sectionId)
      } else {
        return [...prev, sectionId]
      }
    })
  }

  const clearSectionFilter = () => {
    setSelectedSections([])
  }

  const isCooldownActive = cooldownRemaining > 0
  const canGenerate = !isGenerating && !isCooldownActive && project

  // Breadcrumb items
  const breadcrumbItems = useMemo(() => [
    { label: 'Dashboard', href: '/dashboard' },
    { label: project?.name || 'Project', href: `/app/projects/${projectId}` },
    { label: 'User Stories' }
  ], [project?.name, projectId])

  // Loading state
  if (loadingProject) {
    return (
      <main className="main-content">
        <div className="stories-generator-loading">
          <LoadingSpinner />
          <p>Loading project...</p>
        </div>
      </main>
    )
  }

  // Error loading project
  if (projectError) {
    return (
      <main className="main-content">
        <section className="stories-generator-section">
          <div className="section-header">
            <h2>User Stories</h2>
            <Link to="/dashboard" className="back-link">Back to Dashboard</Link>
          </div>
          <div className="stories-generator-error">
            <p>Error loading project: {projectError}</p>
            <button onClick={fetchProject} className="retry-btn">Retry</button>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="main-content">
      <section className="stories-generator-section">
        <Breadcrumbs items={breadcrumbItems} />

        <div className="section-header">
          <h2>User Stories</h2>
          <Link to="/dashboard" className="back-link">Back to Dashboard</Link>
        </div>

        <div className="stories-generator-container">
          {/* Project Info */}
          <div className="stories-generator-project">
            <h3 className="stories-generator-project-label">Project</h3>
            <p className="stories-generator-project-name">{project?.name}</p>
            {project?.description && (
              <p className="stories-generator-project-desc">{project.description}</p>
            )}
          </div>

          {/* Format Selector */}
          <div className="stories-format-selector">
            <h3 className="stories-format-selector-label">Select Story Format</h3>
            <div className="stories-format-options">
              {FORMAT_OPTIONS.map((format) => (
                <button
                  key={format.id}
                  className={`stories-format-option ${selectedFormat === format.id ? 'stories-format-option--selected' : ''}`}
                  onClick={() => setSelectedFormat(format.id)}
                  disabled={isGenerating}
                  type="button"
                >
                  <div className={`stories-format-icon stories-format-icon--${format.id}`}>
                    {format.icon}
                  </div>
                  <div className="stories-format-content">
                    <span className="stories-format-title">{format.title}</span>
                    <span className="stories-format-description">{format.description}</span>
                  </div>
                  <div className="stories-format-check">
                    {selectedFormat === format.id && (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Section Filter */}
          <div className="stories-section-filter">
            <div className="stories-section-filter-header">
              <h3 className="stories-section-filter-label">Filter by Requirement Sections (Optional)</h3>
              {selectedSections.length > 0 && (
                <button
                  type="button"
                  className="stories-section-clear-btn"
                  onClick={clearSectionFilter}
                >
                  Clear ({selectedSections.length})
                </button>
              )}
            </div>
            <div className="stories-section-filter-dropdown" ref={sectionFilterRef}>
              <button
                type="button"
                className="stories-section-filter-trigger"
                onClick={() => setShowSectionFilter(!showSectionFilter)}
                disabled={isGenerating}
              >
                <span>
                  {selectedSections.length === 0
                    ? 'All sections (default)'
                    : `${selectedSections.length} section${selectedSections.length === 1 ? '' : 's'} selected`}
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              {showSectionFilter && (
                <div className="stories-section-filter-menu">
                  {SECTION_OPTIONS.map((section) => (
                    <label key={section.id} className="stories-section-filter-item">
                      <input
                        type="checkbox"
                        checked={selectedSections.includes(section.id)}
                        onChange={() => toggleSection(section.id)}
                      />
                      <span>{section.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <p className="stories-section-filter-hint">
              Leave empty to generate stories from all requirement sections.
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="stories-generator-error-message">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <div className="stories-generator-error-content">
                <p>{error}</p>
                <button onClick={handleRetry} className="stories-generator-retry-btn">
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Generate Button */}
          <div className="stories-generator-actions">
            <button
              className="stories-generate-btn"
              onClick={handleGenerate}
              disabled={!canGenerate}
              type="button"
            >
              {isCooldownActive ? (
                <>Cooldown ({cooldownRemaining}s)</>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" y1="6" x2="21" y2="6"/>
                    <line x1="8" y1="12" x2="21" y2="12"/>
                    <line x1="8" y1="18" x2="21" y2="18"/>
                    <line x1="3" y1="6" x2="3.01" y2="6"/>
                    <line x1="3" y1="12" x2="3.01" y2="12"/>
                    <line x1="3" y1="18" x2="3.01" y2="18"/>
                  </svg>
                  Generate Stories
                </>
              )}
            </button>
            {isCooldownActive && !isGenerating && (
              <p className="stories-cooldown-hint">
                Please wait before generating again
              </p>
            )}
          </div>

          {/* Existing Stories List */}
          {!isGenerating && (
            <div className="stories-existing-list">
              <div className="stories-existing-header">
                <h3 className="stories-existing-label">
                  {filterBatchId ? 'Filtered Stories' : 'Existing Stories'} ({stories.length})
                </h3>
                <button
                  type="button"
                  className="stories-export-btn"
                  onClick={() => setShowExportModal(true)}
                  disabled={stories.length === 0}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Export
                </button>
              </div>

              {/* Batch Filter */}
              <div className="stories-batch-filter-wrapper">
                <StoryBatchFilter
                  projectId={projectId}
                  selectedBatchId={filterBatchId}
                  onBatchChange={handleBatchFilterChange}
                  onBatchDeleted={handleBatchDeleted}
                />
              </div>

              {stories.length > 0 ? (
                <div className="stories-existing-items">
                  {stories.map((story) => (
                    <StoryCard
                      key={story.id}
                      story={story}
                      onEdit={handleEditStory}
                      onDelete={handleDeleteStory}
                    />
                  ))}
                </div>
              ) : (
                <div className="stories-existing-empty">
                  {filterBatchId ? (
                    <p>No stories in the selected batch.</p>
                  ) : (
                    <p>No stories yet. Generate some to get started!</p>
                  )}
                </div>
              )}
            </div>
          )}

          {loadingStories && (
            <div className="stories-existing-loading">
              <LoadingSpinner size="small" />
              <span>Loading existing stories...</span>
            </div>
          )}
        </div>

        {/* Progress Overlay with Streaming Content */}
        {isGenerating && (
          <div className="stories-progress-overlay">
            <div className="stories-progress-modal stories-progress-modal--streaming">
              <div className="stories-progress-header">
                <div className="stories-progress-spinner">
                  <LoadingSpinner size="medium" />
                </div>
                <div className="stories-progress-info">
                  <h3 className="stories-progress-title">
                    {streamingStatus === 'connecting' ? 'Connecting...' : 'Generating Stories...'}
                  </h3>
                  <p className="stories-progress-desc">
                    {streamingStories.length > 0
                      ? `${streamingStories.length} stor${streamingStories.length === 1 ? 'y' : 'ies'} generated`
                      : 'The AI is analyzing your requirements...'}
                  </p>
                </div>
                <button
                  className="stories-cancel-btn"
                  onClick={handleCancel}
                  type="button"
                >
                  Cancel
                </button>
              </div>

              {/* Streaming Stories Preview */}
              <div className="stories-streaming-content">
                {streamingStories.length > 0 ? (
                  <div className="stories-streaming-list">
                    {streamingStories.map((story, index) => (
                      <div key={story.id || index} className="stories-streaming-item">
                        <div className="stories-streaming-item-header">
                          <span className="stories-streaming-item-number">{index + 1}</span>
                          <span className="stories-streaming-item-title">{story.title}</span>
                        </div>
                        {story.description && (
                          <div className="stories-streaming-item-preview">
                            {story.description.substring(0, 120)}
                            {story.description.length > 120 ? '...' : ''}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="stories-streaming-waiting">
                    <p>Waiting for AI response...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Info Dialog */}
        {showInfoDialog && (
          <div className="stories-info-overlay">
            <div className="stories-info-modal">
              <div className="stories-info-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="16" x2="12" y2="12"/>
                  <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
              </div>
              <h3 className="stories-info-title">Stories Will Be Added</h3>
              <p className="stories-info-desc">
                Generating new stories will <strong>add</strong> them to your existing {stories.length} stories.
                They will not replace or overwrite existing stories.
              </p>
              <p className="stories-info-hint">
                You can delete individual stories or entire batches later if needed.
              </p>
              <div className="stories-info-actions">
                <button
                  className="stories-info-cancel-btn"
                  onClick={handleCancelDialog}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="stories-info-confirm-btn"
                  onClick={handleConfirmGenerate}
                  type="button"
                >
                  Continue & Generate
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Story Edit Modal */}
        {editingStory && (
          <StoryEditModal
            story={editingStory}
            onSave={handleSaveStory}
            onClose={handleCloseEditModal}
            isSaving={isSavingStory}
          />
        )}

        {/* Stories Export Modal */}
        {showExportModal && (
          <StoriesExportModal
            projectId={projectId}
            projectName={project?.name || 'Project'}
            onClose={() => setShowExportModal(false)}
          />
        )}
      </section>
    </main>
  )
}

export default UserStoriesPage
