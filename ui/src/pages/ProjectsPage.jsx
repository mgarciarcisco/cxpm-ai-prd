import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { get, post, put, del } from '../services/api'
import ProjectCard from '../components/projects/ProjectCard'
import Modal from '../components/common/Modal'
import ProjectForm from '../components/projects/ProjectForm'
import LoadingSpinner from '../components/common/LoadingSpinner'
import { EmptyState } from '../components/common/EmptyState'
import './ProjectsPage.css'

function ProjectsPage() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [deletingProject, setDeletingProject] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

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
    setEditingProject(project)
    setIsModalOpen(true)
  }

  const handleDelete = (project) => {
    setDeletingProject(project)
    setDeleteError(null)
  }

  const handleCancelDelete = () => {
    setDeletingProject(null)
    setDeleteError(null)
  }

  const handleConfirmDelete = async () => {
    if (!deletingProject) return

    setIsDeleting(true)
    setDeleteError(null)
    try {
      await del(`/api/projects/${deletingProject.id}`)
      setProjects((prev) => prev.filter((p) => p.id !== deletingProject.id))
      setDeletingProject(null)
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete project')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCreateProject = async (projectData) => {
    const newProject = await post('/api/projects', projectData)
    handleCloseModal()
    setProjects((prev) => [...prev, newProject])
  }

  const handleUpdateProject = async (projectData) => {
    const updatedProject = await put(`/api/projects/${editingProject.id}`, projectData)
    handleCloseModal()
    setProjects((prev) =>
      prev.map((p) => (p.id === updatedProject.id ? updatedProject : p))
    )
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingProject(null)
  }

  return (
    <main className="main-content">
      <section className="tasks-section">
        <div className="section-header">
          <h2>PROJECTS</h2>
          <Link to="/" className="back-link">Back to Home</Link>
        </div>

        <div className="projects-header">
          <button className="new-project-btn" onClick={() => { setEditingProject(null); setIsModalOpen(true); }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 3.33334V12.6667" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3.33334 8H12.6667" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            New Project
          </button>
        </div>

        {isModalOpen && (
          <Modal title={editingProject ? "Edit Project" : "Create New Project"} onClose={handleCloseModal}>
            <ProjectForm
              project={editingProject}
              onSubmit={editingProject ? handleUpdateProject : handleCreateProject}
              onCancel={handleCloseModal}
            />
          </Modal>
        )}

        {deletingProject && (
          <Modal title="Delete Project" onClose={handleCancelDelete}>
            <div className="delete-confirmation">
              <div className="delete-confirmation-icon">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M24 44C35.0457 44 44 35.0457 44 24C44 12.9543 35.0457 4 24 4C12.9543 4 4 12.9543 4 24C4 35.0457 12.9543 44 24 44Z" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M24 16V24" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M24 32H24.02" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p className="delete-confirmation-message">
                Are you sure you want to delete <strong>{deletingProject.name}</strong>?
              </p>
              <p className="delete-confirmation-warning">
                This will permanently delete the project and all its meetings and requirements. This action cannot be undone.
              </p>
              {deleteError && (
                <div className="delete-confirmation-error">
                  {deleteError}
                </div>
              )}
              <div className="delete-confirmation-actions">
                <button
                  className="delete-confirmation-btn delete-confirmation-btn--cancel"
                  onClick={handleCancelDelete}
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  className="delete-confirmation-btn delete-confirmation-btn--confirm"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete Project'}
                </button>
              </div>
            </div>
          </Modal>
        )}

        {loading && (
          <div className="projects-loading">
            <LoadingSpinner size="large" />
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
          <EmptyState
            icon={
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M42 30V38C42 39.0609 41.5786 40.0783 40.8284 40.8284C40.0783 41.5786 39.0609 42 38 42H10C8.93913 42 7.92172 41.5786 7.17157 40.8284C6.42143 40.0783 6 39.0609 6 38V10C6 8.93913 6.42143 7.92172 7.17157 7.17157C7.92172 6.42143 8.93913 6 10 6H18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M34 6H42V14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M20 28L42 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            }
            title="Create your first project"
            description="Get started by creating a project to organize your meeting notes and requirements."
            actionButton={
              <button onClick={() => { setEditingProject(null); setIsModalOpen(true); }}>
                New Project
              </button>
            }
          />
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
