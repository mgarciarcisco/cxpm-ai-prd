import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { get } from '../services/api'
import ProjectCard from '../components/projects/ProjectCard'
import './ProjectsPage.css'

function ProjectsPage() {
  const [projects, setProjects] = useState([])
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

  const handleEdit = (project) => {
    // Will be implemented in US-120
    console.log('Edit project:', project)
  }

  const handleDelete = (project) => {
    // Will be implemented in US-121
    console.log('Delete project:', project)
  }

  return (
    <main className="main-content">
      <section className="tasks-section">
        <div className="section-header">
          <h2>PROJECTS</h2>
          <Link to="/" className="back-link">Back to Home</Link>
        </div>

        <div className="projects-header">
          <button className="new-project-btn">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 3.33334V12.6667" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3.33334 8H12.6667" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            New Project
          </button>
        </div>

        {loading && (
          <div className="projects-loading">
            <div className="loading-spinner"></div>
            <p>Loading projects...</p>
          </div>
        )}

        {error && (
          <div className="projects-error">
            <p>Error loading projects: {error}</p>
            <button onClick={fetchProjects} className="retry-btn">Retry</button>
          </div>
        )}

        {!loading && !error && projects.length === 0 && (
          <div className="projects-empty">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M42 30V38C42 39.0609 41.5786 40.0783 40.8284 40.8284C40.0783 41.5786 39.0609 42 38 42H10C8.93913 42 7.92172 41.5786 7.17157 40.8284C6.42143 40.0783 6 39.0609 6 38V10C6 8.93913 6.42143 7.92172 7.17157 7.17157C7.92172 6.42143 8.93913 6 10 6H18" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M34 6H42V14" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M20 28L42 6" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <h3>No projects yet</h3>
            <p>Create your first project to start converting meeting notes into requirements.</p>
          </div>
        )}

        {!loading && !error && projects.length > 0 && (
          <div className="projects-grid">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                meetingCount={0}
                lastActivity={project.updated_at}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

export default ProjectsPage
