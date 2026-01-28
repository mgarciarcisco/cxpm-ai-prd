import { useState, useEffect } from 'react'
import './ProjectForm.css'

function ProjectForm({ project, onSubmit, onCancel }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isEditMode = !!project

  // Pre-fill form when project prop is passed (edit mode)
  useEffect(() => {
    if (project) {
      setName(project.name || '')
      setDescription(project.description || '')
    }
  }, [project])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      return
    }

    setIsSubmitting(true)

    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || null
      })
    } catch (err) {
      setError(err.message || 'An error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isSubmitDisabled = !name.trim() || isSubmitting

  return (
    <form className="project-form" onSubmit={handleSubmit}>
      {error && (
        <div className="project-form-error" role="alert">
          {error}
        </div>
      )}

      <div className="project-form-field">
        <label htmlFor="project-name" className="project-form-label">
          Project Name <span className="project-form-required">*</span>
        </label>
        <input
          type="text"
          id="project-name"
          className="project-form-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter project name"
          required
          autoFocus
        />
      </div>

      <div className="project-form-field">
        <label htmlFor="project-description" className="project-form-label">
          Description
        </label>
        <textarea
          id="project-description"
          className="project-form-textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter project description (optional)"
          rows={4}
        />
      </div>

      <div className="project-form-actions">
        {onCancel && (
          <button
            type="button"
            className="project-form-btn project-form-btn--secondary"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="project-form-btn project-form-btn--primary"
          disabled={isSubmitDisabled}
        >
          {isSubmitting ? 'Saving...' : isEditMode ? 'Update Project' : 'Create Project'}
        </button>
      </div>
    </form>
  )
}

export default ProjectForm
