import React from 'react'
import { Link } from 'react-router-dom'

function ProjectsPage() {
  return (
    <main className="main-content">
      <section className="tasks-section">
        <div className="section-header">
          <h2>PROJECTS</h2>
          <Link to="/" className="back-link">Back to Home</Link>
        </div>

        <div className="projects-placeholder">
          <p>Projects will be displayed here.</p>
        </div>
      </section>
    </main>
  )
}

export default ProjectsPage
