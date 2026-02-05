import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { get } from '../services/api';
import { Breadcrumbs } from '../components/common/Breadcrumbs';
import './SelectProjectPage.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:8000');

/**
 * Format relative time (e.g., "2 days ago", "1 week ago")
 */
function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  if (diffMs < 0) return 'Just now';
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return '1 week ago';
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 60) return '1 month ago';
  return `${Math.floor(diffDays / 30)} months ago`;
}

function SelectProjectPage() {
  const { mid } = useParams();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [meeting, setMeeting] = useState(null);

  // Fetch meeting details and projects
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch meeting details
        const meetingData = await get(`/api/meetings/${mid}`);
        setMeeting(meetingData);
        
        // If meeting already has a project, redirect to apply
        if (meetingData.project_id) {
          navigate(`/app/projects/${meetingData.project_id}/meetings/${mid}/apply`);
          return;
        }
        
        // Fetch projects list
        const projectsData = await get('/api/projects');
        // Filter out archived projects and sort by updated_at desc
        const activeProjects = projectsData
          .filter(p => !p.archived)
          .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
        setProjects(activeProjects);
        
      } catch (err) {
        setError(err.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [mid, navigate]);

  const handleSelectProject = (projectId) => {
    setSelectedProjectId(projectId);
    setIsCreatingNew(false);
  };

  const handleSelectNewProject = () => {
    setSelectedProjectId(null);
    setIsCreatingNew(true);
  };

  const handleContinue = async () => {
    if (!selectedProjectId && !isCreatingNew) return;
    
    setSaving(true);
    setError(null);
    
    try {
      let projectId = selectedProjectId;
      
      // Create new project if needed
      if (isCreatingNew && newProjectName.trim()) {
        const response = await fetch(`${API_BASE_URL}/api/projects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newProjectName.trim() }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to create project');
        }
        
        const newProject = await response.json();
        projectId = newProject.id;
      }
      
      // Associate meeting with project
      const formData = new FormData();
      formData.append('project_id', projectId);
      
      const response = await fetch(`${API_BASE_URL}/api/meetings/${mid}/project`, {
        method: 'PATCH',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to associate meeting with project');
      }
      
      // Navigate to conflict resolution
      navigate(`/app/projects/${projectId}/meetings/${mid}/apply`);
      
    } catch (err) {
      setError(err.message || 'Failed to save');
      setSaving(false);
    }
  };

  // Breadcrumb items
  const breadcrumbItems = useMemo(() => [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Extraction Results', href: `/app/meetings/${mid}` },
    { label: 'Select Project' }
  ], [mid]);

  if (loading) {
    return (
      <main className="main-content">
        <div className="select-project-page">
          <div className="select-project-loading">
            <div className="loading-spinner"></div>
            <p>Loading...</p>
          </div>
        </div>
      </main>
    );
  }

  const itemCount = meeting?.items?.length || 0;
  const canContinue = selectedProjectId || (isCreatingNew && newProjectName.trim());

  // Get tooltip text for disabled button
  const getButtonTooltip = () => {
    if (canContinue) return '';
    if (isCreatingNew && !newProjectName.trim()) {
      return 'Enter a project name to continue';
    }
    return 'Select a project or create a new one to continue';
  };

  return (
    <div className="select-project-page">
      <div className="select-project-container">
        {/* Breadcrumbs */}
        <Breadcrumbs items={breadcrumbItems} />

        {/* Main Card */}
        <div className="select-card">
          {/* Card Header */}
          <div className="select-card__header">
            <h1>Save to Project</h1>
            <p>
              Choose where to save <span className="select-card__item-count">{itemCount} extracted items</span> from "{meeting?.title}"
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="select-card__error">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12zM8 5v3M8 11h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Project Options */}
          <div className="select-card__options">
            {/* Create New Project Option */}
            <div
              className={`project-option ${isCreatingNew ? 'project-option--selected' : ''}`}
              onClick={handleSelectNewProject}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && handleSelectNewProject()}
            >
              <label className="project-option__radio">
                <input
                  type="radio"
                  name="project"
                  checked={isCreatingNew}
                  onChange={handleSelectNewProject}
                />
                <span className="project-option__radio-visual"></span>
              </label>
              <div className="project-option__icon project-option__icon--new">+</div>
              <div className="project-option__info">
                <h3>Create New Project</h3>
                <p>Start fresh with these requirements</p>
                {isCreatingNew && (
                  <div className="project-option__input-wrapper">
                    <input
                      type="text"
                      className="project-option__input"
                      placeholder="Enter project name..."
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Existing Projects */}
            {projects.map((project) => (
              <div
                key={project.id}
                className={`project-option ${selectedProjectId === project.id ? 'project-option--selected' : ''}`}
                onClick={() => handleSelectProject(project.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleSelectProject(project.id)}
              >
                <label className="project-option__radio">
                  <input
                    type="radio"
                    name="project"
                    checked={selectedProjectId === project.id}
                    onChange={() => handleSelectProject(project.id)}
                  />
                  <span className="project-option__radio-visual"></span>
                </label>
                <div className="project-option__icon project-option__icon--folder">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
                <div className="project-option__info">
                  <h3>{project.name}</h3>
                  <p>
                    {project.requirements_count > 0
                      ? `${project.requirements_count} existing requirements`
                      : 'Empty project'
                    }
                  </p>
                </div>
                <div className="project-option__meta">
                  <span className="project-option__count">
                    {project.requirements_count || 0} reqs
                  </span>
                  <span className="project-option__updated">
                    {formatRelativeTime(project.updated_at)}
                  </span>
                </div>
              </div>
            ))}

            {projects.length === 0 && (
              <div className="select-card__empty-hint">
                No existing projects found. Create a new project above.
              </div>
            )}

            <div className="select-card__help-text">
              These are your active projects. Archived projects are hidden.
            </div>
          </div>

          {/* Card Footer */}
          <div className="select-card__footer">
            <Link to={`/app/meetings/${mid}`} className="select-btn select-btn--secondary">
              Cancel
            </Link>
            <div className="select-btn-wrapper">
              <button
                className="select-btn select-btn--primary"
                disabled={!canContinue || saving}
                onClick={handleContinue}
                title={getButtonTooltip()}
              >
                {saving ? (
                  <>
                    <span className="select-btn__spinner"></span>
                    Saving...
                  </>
                ) : (
                  <>
                    Continue
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 8h10M9 4l4 4-4 4"/>
                    </svg>
                  </>
                )}
              </button>
              {!canContinue && (
                <div className="select-btn__tooltip">{getButtonTooltip()}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SelectProjectPage;
