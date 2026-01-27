import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { get } from '../services/api'
import LoadingSpinner from '../components/common/LoadingSpinner'
import './PRDLandingPage.css'

// Document icon for the page header
const DocumentIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <line x1="10" y1="9" x2="8" y2="9"/>
  </svg>
)

function PRDLandingPage() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await get('/api/projects')
      setProjects(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleProjectChange = (e) => {
    const projectId = e.target.value
    setSelectedProjectId(projectId)
    if (projectId) {
      navigate(`/app/projects/${projectId}/prd/generate`)
    }
  }

  return (
    <main className="main-content">
      <section className="tasks-section">
        <div className="section-header">
          <h2>GENERATE PRD</h2>
          <Link to="/" className="back-link">Back to Home</Link>
        </div>

        <div className="prd-landing-container">
          <div className="prd-landing-header">
            <div className="prd-landing-icon">
              <DocumentIcon />
            </div>
            <h1 className="prd-landing-title">Product Requirements Document Generator</h1>
            <p className="prd-landing-description">
              Transform your project requirements into a comprehensive PRD. Choose between a quick 
              draft mode to identify gaps and open questions, or a detailed mode for a complete 
              specification document.
            </p>
          </div>

          <div className="prd-landing-features">
            <div className="prd-feature">
              <div className="prd-feature-icon prd-feature-icon--draft">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </div>
              <h3>Draft Mode</h3>
              <p>Quick analysis that highlights gaps, open questions, and areas needing clarification.</p>
            </div>
            <div className="prd-feature">
              <div className="prd-feature-icon prd-feature-icon--detailed">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <line x1="10" y1="9" x2="8" y2="9"/>
                </svg>
              </div>
              <h3>Detailed Mode</h3>
              <p>Complete PRD with all 12 sections including technical considerations and success metrics.</p>
            </div>
          </div>

          <div className="prd-landing-selector">
            <label htmlFor="project-select" className="prd-selector-label">
              Select a project to get started
            </label>

            {loading && (
              <div className="prd-selector-loading">
                <LoadingSpinner size="small" />
                <span>Loading projects...</span>
              </div>
            )}

            {error && (
              <div className="prd-selector-error">
                <p>Error loading projects: {error}</p>
                <button onClick={fetchProjects} className="retry-btn">Retry</button>
              </div>
            )}

            {!loading && !error && projects.length === 0 && (
              <div className="prd-selector-empty">
                <p>No projects found. Create a project first to generate a PRD.</p>
                <Link to="/app" className="create-project-link">Go to Projects</Link>
              </div>
            )}

            {!loading && !error && projects.length > 0 && (
              <select
                id="project-select"
                className="prd-project-select"
                value={selectedProjectId}
                onChange={handleProjectChange}
              >
                <option value="">Choose a project...</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}

export default PRDLandingPage
