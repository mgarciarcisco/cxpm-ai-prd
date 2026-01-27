import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { get } from '../services/api'
import LoadingSpinner from '../components/common/LoadingSpinner'
import './PRDGeneratorPage.css'

// Mode options with descriptions
const MODE_OPTIONS = [
  {
    id: 'draft',
    title: 'Draft Mode',
    description: 'Quick analysis that highlights gaps, open questions, and areas needing clarification. Best for early-stage projects.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
    ),
  },
  {
    id: 'detailed',
    title: 'Detailed Mode',
    description: 'Complete PRD with all 12 sections including technical considerations, success metrics, and risk analysis.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <line x1="10" y1="9" x2="8" y2="9"/>
      </svg>
    ),
  },
]

function PRDGeneratorPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()

  // Project info
  const [project, setProject] = useState(null)
  const [loadingProject, setLoadingProject] = useState(true)
  const [projectError, setProjectError] = useState(null)

  // Generation state
  const [selectedMode, setSelectedMode] = useState('draft')

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

  const handleGenerate = () => {
    // Navigate to the streaming page with the selected mode
    navigate(`/app/projects/${projectId}/prd/streaming`, {
      state: { mode: selectedMode }
    })
  }

  const canGenerate = project !== null

  // Loading state
  if (loadingProject) {
    return (
      <main className="main-content">
        <div className="prd-generator-loading">
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
        <section className="prd-generator-section">
          <div className="section-header">
            <h2>Generate PRD</h2>
            <Link to="/app/prd" className="back-link">Back to PRD</Link>
          </div>
          <div className="prd-generator-error">
            <p>Error loading project: {projectError}</p>
            <button onClick={fetchProject} className="retry-btn">Retry</button>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="main-content">
      <section className="prd-generator-section">
        <div className="section-header">
          <h2>Generate PRD</h2>
          <Link to="/app/prd" className="back-link">Back to PRD</Link>
        </div>

        <div className="prd-generator-container">
          {/* Project Info */}
          <div className="prd-generator-project">
            <h3 className="prd-generator-project-label">Project</h3>
            <p className="prd-generator-project-name">{project?.name}</p>
            {project?.description && (
              <p className="prd-generator-project-desc">{project.description}</p>
            )}
          </div>

          {/* Mode Selector */}
          <div className="prd-mode-selector">
            <h3 className="prd-mode-selector-label">Select PRD Mode</h3>
            <div className="prd-mode-options">
              {MODE_OPTIONS.map((mode) => (
                <button
                  key={mode.id}
                  className={`prd-mode-option ${selectedMode === mode.id ? 'prd-mode-option--selected' : ''}`}
                  onClick={() => setSelectedMode(mode.id)}
                  type="button"
                >
                  <div className={`prd-mode-icon prd-mode-icon--${mode.id}`}>
                    {mode.icon}
                  </div>
                  <div className="prd-mode-content">
                    <span className="prd-mode-title">{mode.title}</span>
                    <span className="prd-mode-description">{mode.description}</span>
                  </div>
                  <div className="prd-mode-check">
                    {selectedMode === mode.id && (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <div className="prd-generator-actions">
            <button
              className="prd-generate-btn"
              onClick={handleGenerate}
              disabled={!canGenerate}
              type="button"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
              Generate PRD
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}

export default PRDGeneratorPage
