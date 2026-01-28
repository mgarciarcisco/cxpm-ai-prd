import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../common/Modal';
import { post } from '../../services/api';
import './NewProjectModal.css';

/**
 * Modal for creating a new project
 *
 * @param {object} props
 * @param {function} props.onClose - Callback to close modal
 * @param {function} [props.onCreated] - Optional callback after project is created
 */
function NewProjectModal({ onClose, onCreated }) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  const isNameValid = name.trim().length > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isNameValid) {
      setError('Project name is required');
      return;
    }

    try {
      setCreating(true);
      setError(null);

      const project = await post('/api/projects', {
        name: name.trim(),
        description: description.trim() || null,
      });

      // Call optional callback
      if (onCreated) {
        onCreated(project);
      }

      // Navigate to the new project
      navigate(`/projects/${project.id}`);
    } catch (err) {
      console.error('Failed to create project:', err);
      setError(err.message || 'Failed to create project');
      setCreating(false);
    }
  };

  return (
    <Modal title="Create New Project" onClose={onClose}>
      <form className="new-project-modal" onSubmit={handleSubmit}>
        <div className="new-project-modal__field">
          <label htmlFor="project-name" className="new-project-modal__label">
            Project Name <span className="new-project-modal__required">*</span>
          </label>
          <input
            id="project-name"
            type="text"
            className="new-project-modal__input"
            placeholder="Enter project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={creating}
            autoFocus
          />
        </div>

        <div className="new-project-modal__field">
          <label htmlFor="project-description" className="new-project-modal__label">
            Description <span className="new-project-modal__optional">(optional)</span>
          </label>
          <textarea
            id="project-description"
            className="new-project-modal__textarea"
            placeholder="Brief description of your project"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={creating}
            rows={3}
          />
        </div>

        {error && (
          <div className="new-project-modal__error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        <div className="new-project-modal__actions">
          <button
            type="button"
            className="new-project-modal__cancel-btn"
            onClick={onClose}
            disabled={creating}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="new-project-modal__create-btn"
            disabled={creating || !isNameValid}
          >
            {creating ? (
              <>
                <svg className="new-project-modal__spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                </svg>
                Creating...
              </>
            ) : (
              'Create Project'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default NewProjectModal;
