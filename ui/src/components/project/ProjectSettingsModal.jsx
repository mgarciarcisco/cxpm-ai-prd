import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../common/Modal';
import { ConfirmationDialog } from '../common/ConfirmationDialog';
import { put, del } from '../../services/api';
import './ProjectSettingsModal.css';

/**
 * Modal for project settings - rename, archive, and delete
 *
 * @param {object} props
 * @param {object} props.project - The project object with id, name, description, archived
 * @param {function} props.onClose - Callback to close the modal
 * @param {function} props.onProjectUpdated - Callback when project is updated (receives updated project)
 * @param {function} props.onProjectDeleted - Callback when project is deleted
 */
function ProjectSettingsModal({ project, onClose, onProjectUpdated, onProjectDeleted }) {
  const navigate = useNavigate();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || '');
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isNameValid = name.trim().length > 0;
  const hasChanges = name !== project.name || description !== (project.description || '');

  const handleSave = useCallback(async () => {
    if (!isNameValid || !hasChanges) return;

    try {
      setSaving(true);
      setError(null);

      const updatedProject = await put(`/api/projects/${project.id}`, {
        name: name.trim(),
        description: description.trim() || null,
      });

      if (onProjectUpdated) {
        onProjectUpdated(updatedProject);
      }
      onClose();
    } catch (err) {
      console.error('Failed to update project:', err);
      setError(err.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  }, [project.id, name, description, isNameValid, hasChanges, onProjectUpdated, onClose]);

  const handleArchive = useCallback(async () => {
    try {
      setArchiving(true);
      setError(null);

      const updatedProject = await put(`/api/projects/${project.id}`, {
        archived: !project.archived,
      });

      if (onProjectUpdated) {
        onProjectUpdated(updatedProject);
      }

      // Navigate to dashboard after archiving
      if (!project.archived) {
        navigate('/dashboard');
      }
      onClose();
    } catch (err) {
      console.error('Failed to archive project:', err);
      setError(err.message || 'Failed to archive project');
    } finally {
      setArchiving(false);
    }
  }, [project.id, project.archived, onProjectUpdated, onClose, navigate]);

  const handleDelete = useCallback(async () => {
    try {
      setDeleting(true);
      setError(null);

      await del(`/api/projects/${project.id}`);

      if (onProjectDeleted) {
        onProjectDeleted();
      }

      // Navigate to dashboard after deletion
      navigate('/dashboard');
    } catch (err) {
      console.error('Failed to delete project:', err);
      setError(err.message || 'Failed to delete project');
      setDeleting(false);
      setShowDeleteConfirmation(false);
    }
  }, [project.id, onProjectDeleted, navigate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    handleSave();
  };

  return (
    <>
      <Modal title="Project Settings" onClose={onClose}>
        <form className="project-settings-modal" onSubmit={handleSubmit}>
          {/* Rename Section */}
          <section className="project-settings-modal__section">
            <h3 className="project-settings-modal__section-title">Project Details</h3>

            <div className="project-settings-modal__field">
              <label htmlFor="project-name" className="project-settings-modal__label">
                Name <span className="project-settings-modal__required">*</span>
              </label>
              <input
                id="project-name"
                type="text"
                className="project-settings-modal__input"
                placeholder="Enter project name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={saving || archiving}
                autoFocus
              />
            </div>

            <div className="project-settings-modal__field">
              <label htmlFor="project-description" className="project-settings-modal__label">
                Description <span className="project-settings-modal__optional">(optional)</span>
              </label>
              <textarea
                id="project-description"
                className="project-settings-modal__textarea"
                placeholder="Brief description of your project"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={saving || archiving}
                rows={3}
              />
            </div>

            <div className="project-settings-modal__save-row">
              <button
                type="submit"
                className="project-settings-modal__save-btn"
                disabled={saving || archiving || !isNameValid || !hasChanges}
              >
                {saving ? (
                  <>
                    <svg className="project-settings-modal__spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                    </svg>
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </section>

          {/* Archive Section */}
          <section className="project-settings-modal__section">
            <h3 className="project-settings-modal__section-title">
              {project.archived ? 'Restore Project' : 'Archive Project'}
            </h3>
            <p className="project-settings-modal__section-description">
              {project.archived
                ? 'Restore this project to make it visible in your main project list.'
                : 'Archived projects are hidden from the main list but can be restored later.'}
            </p>
            <button
              type="button"
              className={`project-settings-modal__archive-btn ${project.archived ? 'project-settings-modal__archive-btn--restore' : ''}`}
              onClick={handleArchive}
              disabled={saving || archiving}
            >
              {archiving ? (
                <>
                  <svg className="project-settings-modal__spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                  </svg>
                  {project.archived ? 'Restoring...' : 'Archiving...'}
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {project.archived ? (
                      <>
                        <polyline points="1 4 1 10 7 10" />
                        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                      </>
                    ) : (
                      <>
                        <polyline points="21 8 21 21 3 21 3 8" />
                        <rect x="1" y="3" width="22" height="5" />
                        <line x1="10" y1="12" x2="14" y2="12" />
                      </>
                    )}
                  </svg>
                  {project.archived ? 'Restore Project' : 'Archive Project'}
                </>
              )}
            </button>
          </section>

          {/* Delete Section */}
          <section className="project-settings-modal__section project-settings-modal__section--danger">
            <h3 className="project-settings-modal__section-title project-settings-modal__section-title--danger">
              Delete Project
            </h3>
            <p className="project-settings-modal__section-description">
              Permanently delete this project and all its data. This action cannot be undone.
            </p>
            <button
              type="button"
              className="project-settings-modal__delete-btn"
              onClick={() => setShowDeleteConfirmation(true)}
              disabled={saving || archiving}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
              Delete Project
            </button>
          </section>

          {error && (
            <div className="project-settings-modal__error">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showDeleteConfirmation}
        onClose={() => setShowDeleteConfirmation(false)}
        onConfirm={handleDelete}
        title="Delete Project"
        message={`Are you sure you want to delete "${project.name}"? This will permanently remove the project and all associated data including requirements, PRDs, user stories, and mockups.`}
        confirmLabel="Delete Project"
        cancelLabel="Cancel"
        variant="danger"
        confirmText={project.name}
        loading={deleting}
      />
    </>
  );
}

export default ProjectSettingsModal;
