import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../common/Modal';
import { get, post } from '../../services/api';
import './SaveToProjectModal.css';

/**
 * Modal for saving Quick Convert results to a project.
 * Offers two options: create a new project or add to an existing one.
 *
 * @param {object} props
 * @param {function} props.onClose - Callback to close the modal
 * @param {string} props.dataType - Type of data being saved ('requirements', 'prd', 'stories')
 * @param {object} props.data - The data to save (structure depends on dataType)
 * @param {function} [props.onSaved] - Optional callback after successful save
 */
function SaveToProjectModal({ onClose, dataType, data, onSaved }) {
  const navigate = useNavigate();

  // Save option state
  const [saveOption, setSaveOption] = useState('new'); // 'new' or 'existing'

  // New project form state
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');

  // Existing project state
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');

  // Submission state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Form validation
  const isNewFormValid = newName.trim().length > 0;
  const isExistingFormValid = selectedProjectId !== '';
  const isFormValid = saveOption === 'new' ? isNewFormValid : isExistingFormValid;

  // Fetch existing projects when "existing" option is selected
  useEffect(() => {
    if (saveOption === 'existing' && projects.length === 0) {
      fetchProjects();
    }
  }, [saveOption, projects.length]);

  const fetchProjects = async () => {
    try {
      setLoadingProjects(true);
      const projectList = await get('/api/projects');
      // Filter out archived projects
      const activeProjects = projectList.filter(p => !p.archived);
      setProjects(activeProjects);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
      setError('Failed to load projects');
    } finally {
      setLoadingProjects(false);
    }
  };

  // Get label text based on data type
  const getDataTypeLabel = () => {
    switch (dataType) {
      case 'requirements':
        return 'requirements';
      case 'prd':
        return 'PRD';
      case 'stories':
        return 'user stories';
      default:
        return 'data';
    }
  };

  // Save data to a project
  const saveDataToProject = async (projectId) => {
    switch (dataType) {
      case 'requirements':
        // Save requirements - data is { section: [{ content, selected }] }
        // Convert to API format and save each selected item
        for (const [section, items] of Object.entries(data)) {
          const selectedItems = items.filter(item => item.selected);
          for (const item of selectedItems) {
            await post(`/api/projects/${projectId}/requirements`, {
              section,
              content: item.content,
            });
          }
        }
        break;

      case 'prd':
        // Save PRD - data is the PRD content object
        await post(`/api/projects/${projectId}/prds`, {
          title: data.title || 'Imported PRD',
          sections: data.sections || [],
          status: 'draft',
        });
        break;

      case 'stories': {
        // Save stories - data is an array of story objects
        const selectedStories = Array.isArray(data)
          ? data.filter(s => s.selected !== false)
          : [];
        for (const story of selectedStories) {
          await post(`/api/projects/${projectId}/stories`, {
            title: story.title,
            description: story.description,
            acceptance_criteria: story.acceptance_criteria || [],
            labels: story.labels || [],
            size: story.size || 'M',
            priority: story.priority || 'P2',
          });
        }
        break;
      }

      default:
        throw new Error(`Unknown data type: ${dataType}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isFormValid) return;

    try {
      setSaving(true);
      setError(null);

      let projectId;
      let projectName;

      if (saveOption === 'new') {
        // Create new project first
        const newProject = await post('/api/projects', {
          name: newName.trim(),
          description: newDescription.trim() || null,
        });
        projectId = newProject.id;
        projectName = newProject.name;
      } else {
        // Use selected existing project
        projectId = selectedProjectId;
        const selectedProject = projects.find(p => p.id === selectedProjectId);
        projectName = selectedProject?.name || 'Project';
      }

      // Save the data to the project
      await saveDataToProject(projectId);

      // Call optional callback
      if (onSaved) {
        onSaved({ projectId, projectName });
      }

      // Navigate to the project
      navigate(`/projects/${projectId}`);
    } catch (err) {
      console.error('Failed to save:', err);
      setError(err.message || 'Failed to save to project');
      setSaving(false);
    }
  };

  // Get selected project info for warning message
  const selectedProject = projects.find(p => p.id === selectedProjectId);

  return (
    <Modal title="Save to Project" onClose={onClose}>
      <form className="save-to-project-modal" onSubmit={handleSubmit}>
        {/* Save Option Toggle */}
        <div className="save-to-project-modal__options">
          <button
            type="button"
            className={`save-to-project-modal__option ${saveOption === 'new' ? 'save-to-project-modal__option--active' : ''}`}
            onClick={() => setSaveOption('new')}
            disabled={saving}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Create New Project
          </button>
          <button
            type="button"
            className={`save-to-project-modal__option ${saveOption === 'existing' ? 'save-to-project-modal__option--active' : ''}`}
            onClick={() => setSaveOption('existing')}
            disabled={saving}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3h18v18H3z" />
              <path d="M12 8v8" />
              <path d="M8 12h8" />
            </svg>
            Add to Existing
          </button>
        </div>

        {/* New Project Form */}
        {saveOption === 'new' && (
          <div className="save-to-project-modal__form-section">
            <div className="save-to-project-modal__field">
              <label htmlFor="project-name" className="save-to-project-modal__label">
                Project Name <span className="save-to-project-modal__required">*</span>
              </label>
              <input
                id="project-name"
                type="text"
                className="save-to-project-modal__input"
                placeholder="Enter project name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                disabled={saving}
                autoFocus
              />
            </div>

            <div className="save-to-project-modal__field">
              <label htmlFor="project-description" className="save-to-project-modal__label">
                Description <span className="save-to-project-modal__optional">(optional)</span>
              </label>
              <textarea
                id="project-description"
                className="save-to-project-modal__textarea"
                placeholder="Brief description of your project"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                disabled={saving}
                rows={3}
              />
            </div>
          </div>
        )}

        {/* Existing Project Form */}
        {saveOption === 'existing' && (
          <div className="save-to-project-modal__form-section">
            <div className="save-to-project-modal__field">
              <label htmlFor="existing-project" className="save-to-project-modal__label">
                Select Project <span className="save-to-project-modal__required">*</span>
              </label>
              {loadingProjects ? (
                <div className="save-to-project-modal__loading">
                  <div className="save-to-project-modal__spinner-small" />
                  Loading projects...
                </div>
              ) : projects.length === 0 ? (
                <div className="save-to-project-modal__no-projects">
                  <p>No projects found.</p>
                  <button
                    type="button"
                    className="save-to-project-modal__switch-link"
                    onClick={() => setSaveOption('new')}
                  >
                    Create a new project instead
                  </button>
                </div>
              ) : (
                <select
                  id="existing-project"
                  className="save-to-project-modal__select"
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  disabled={saving}
                >
                  <option value="">Choose a project...</option>
                  {projects.map(project => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Warning about replacing existing data */}
            {selectedProject && (
              <div className="save-to-project-modal__warning">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <div>
                  <strong>Note:</strong> Adding {getDataTypeLabel()} to "{selectedProject.name}" will
                  {dataType === 'prd' ? ' create a new PRD version' : ' add to existing items'}.
                  {dataType === 'prd' && ' The current PRD (if any) will remain in version history.'}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="save-to-project-modal__error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="save-to-project-modal__actions">
          <button
            type="button"
            className="save-to-project-modal__cancel-btn"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="save-to-project-modal__save-btn"
            disabled={saving || !isFormValid}
          >
            {saving ? (
              <>
                <svg className="save-to-project-modal__spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                </svg>
                Saving...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                Save & Open Project
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default SaveToProjectModal;
