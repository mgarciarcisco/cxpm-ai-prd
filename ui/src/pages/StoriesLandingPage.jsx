import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { get } from '../services/api'
import LoadingSpinner from '../components/common/LoadingSpinner'
import './StoriesLandingPage.css'

// List icon for the page header
const ListIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6"/>
    <line x1="8" y1="12" x2="21" y2="12"/>
    <line x1="8" y1="18" x2="21" y2="18"/>
    <line x1="3" y1="6" x2="3.01" y2="6"/>
    <line x1="3" y1="12" x2="3.01" y2="12"/>
    <line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
)

function StoriesLandingPage() {
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
      navigate(`/app/projects/${projectId}/stories`)
    }
  }

  return (
    <main className="main-content">
      <section className="tasks-section">
        <div className="section-header">
          <h2>USER STORIES</h2>
          <Link to="/" className="back-link">Back to Home</Link>
        </div>

        <div className="stories-landing-container">
          <div className="stories-landing-header">
            <div className="stories-landing-icon">
              <ListIcon />
            </div>
            <h1 className="stories-landing-title">User Story Generator</h1>
            <p className="stories-landing-description">
              Transform your project requirements into actionable user stories for development. 
              Choose between classic user story format or job story format based on your 
              team's preferences and methodology.
            </p>
          </div>

          <div className="stories-landing-features">
            <div className="stories-feature">
              <div className="stories-feature-icon stories-feature-icon--classic">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <h3>Classic Format</h3>
              <p>"As a [user], I want [goal], so that [benefit]" - the standard user story format.</p>
            </div>
            <div className="stories-feature">
              <div className="stories-feature-icon stories-feature-icon--job">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <h3>Job Story Format</h3>
              <p>"When [situation], I want to [action], so I can [outcome]" - focuses on context and motivation.</p>
            </div>
          </div>

          <div className="stories-landing-info">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            <span>Stories are added incrementally - each generation creates new stories without replacing existing ones.</span>
          </div>

          <div className="stories-landing-selector">
            <label htmlFor="project-select" className="stories-selector-label">
              Select a project to get started
            </label>

            {loading && (
              <div className="stories-selector-loading">
                <LoadingSpinner size="small" />
                <span>Loading projects...</span>
              </div>
            )}

            {error && (
              <div className="stories-selector-error">
                <p>Error loading projects: {error}</p>
                <button onClick={fetchProjects} className="retry-btn">Retry</button>
              </div>
            )}

            {!loading && !error && projects.length === 0 && (
              <div className="stories-selector-empty">
                <p>No projects found. Create a project first to generate user stories.</p>
                <Link to="/app" className="create-project-link">Go to Projects</Link>
              </div>
            )}

            {!loading && !error && projects.length > 0 && (
              <select
                id="project-select"
                className="stories-project-select"
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

export default StoriesLandingPage
