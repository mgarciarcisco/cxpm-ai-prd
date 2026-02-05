import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom'
import { get } from '../services/api'
import { usePRDStreamingV2 } from '../hooks/usePRDStreamingV2'
import PRDStreamingPreviewV2 from '../components/prd/PRDStreamingPreviewV2'
import LoadingSpinner from '../components/common/LoadingSpinner'
import './PRDStreamingPage.css'

function PRDStreamingPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  // Get mode from navigation state (default to draft)
  const mode = location.state?.mode || 'draft'

  // Project info
  const [project, setProject] = useState(null)
  const [loadingProject, setLoadingProject] = useState(true)
  const [projectError, setProjectError] = useState(null)

  // Generation state - start immediately when page loads
  const [isGenerating, setIsGenerating] = useState(true)
  const [localError, setLocalError] = useState(null)

  // Use v2 streaming hook for staged PRD generation
  const {
    sections,
    getSortedSections,
    currentStage,
    streamingSection,
    getCompletedCount,
    getTotalCount,
    status: streamingStatus,
    error: streamingError,
    prdId,
    version,
    sectionCount,
    failedCount,
    retry,
  } = usePRDStreamingV2(projectId, mode, isGenerating)

  // Handle streaming completion
  useEffect(() => {
    if (streamingStatus === 'complete' || streamingStatus === 'partial') {
      setIsGenerating(false)
    }
  }, [streamingStatus])

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

  const handleCancel = useCallback(() => {
    setIsGenerating(false)
    // Navigate back to PRD generator page
    navigate(`/app/projects/${projectId}/prd/generate`)
  }, [navigate, projectId])

  const handleRetry = useCallback(() => {
    setLocalError(null)
    setIsGenerating(true)
    retry()
  }, [retry])

  const handleViewPRD = useCallback((id) => {
    navigate(`/app/prds/${id}`)
  }, [navigate])

  const handleRegenerateSection = useCallback((sectionId) => {
    // TODO: Implement section regeneration UI
    console.log('Regenerate section:', sectionId)
  }, [])

  // Combined error from streaming or local
  const error = localError || streamingError

  // Loading state
  if (loadingProject) {
    return (
      <main className="main-content">
        <div className="prd-streaming-page-loading">
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
        <section className="prd-streaming-page-section">
          <div className="section-header">
            <h2>Generate PRD</h2>
            <Link to={`/app/projects/${projectId}/prd/generate`} className="back-link">
              Back to PRD Generator
            </Link>
          </div>
          <div className="prd-streaming-page-error">
            <p>Error loading project: {projectError}</p>
            <button onClick={fetchProject} className="retry-btn">Retry</button>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="main-content">
      <section className="prd-streaming-page-section">
        <div className="section-header">
          <div className="section-header-left">
            <Link to={`/app/projects/${projectId}/prd/generate`} className="back-link-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </Link>
            <div>
              <h2>Generating PRD</h2>
              <p className="section-subtitle">
                {project?.name} • {mode === 'detailed' ? 'Detailed Mode' : 'Draft Mode'}
              </p>
            </div>
          </div>
        </div>

        <div className="prd-streaming-page-container">
          <PRDStreamingPreviewV2
            sections={sections}
            getSortedSections={getSortedSections}
            currentStage={currentStage}
            streamingSection={streamingSection}
            getCompletedCount={getCompletedCount}
            getTotalCount={getTotalCount}
            status={streamingStatus}
            error={error}
            onRetry={handleRetry}
            onCancel={handleCancel}
            prdId={prdId}
            onViewPRD={handleViewPRD}
            onRegenerateSection={handleRegenerateSection}
          />
        </div>
      </section>
    </main>
  )
}

export default PRDStreamingPage
