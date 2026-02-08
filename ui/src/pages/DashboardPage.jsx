import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { get, post, del } from '../services/api';
import ProjectCard from '../components/projects/ProjectCard';
import ProjectCardSkeleton from '../components/projects/ProjectCardSkeleton';
import ProjectSearch from '../components/dashboard/ProjectSearch';
import EmptyState from '../components/common/EmptyState';
import Modal from '../components/common/Modal';
import ProjectForm from '../components/projects/ProjectForm';
import CapabilityCard from '../components/common/CapabilityCard';
import HeroProjectCard from '../components/dashboard/HeroProjectCard';
import { CAPABILITIES } from '../constants/capabilities.jsx';
import './DashboardPage.css';

function DashboardPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const searchQuery = searchParams.get('search') || '';

  // Fetch projects and their stats
  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const projectList = await get('/api/projects');

      const projectsWithStats = await Promise.all(
        projectList.map(async (project) => {
          try {
            const stats = await get(`/api/projects/${project.id}/stats`);
            return {
              ...project,
              meetingCount: stats.meeting_count,
              requirementCount: stats.requirement_count,
              jiraEpicCount: stats.jira_story_count ?? 0,
              lastActivity: stats.last_activity,
            };
          } catch {
            return {
              ...project,
              meetingCount: 0,
              requirementCount: 0,
              jiraEpicCount: 0,
              lastActivity: project.updated_at,
            };
          }
        })
      );

      // Sort by last activity (most recent first)
      const sortedProjects = projectsWithStats.sort((a, b) => {
        const dateA = new Date(a.lastActivity || a.updated_at || a.created_at);
        const dateB = new Date(b.lastActivity || b.updated_at || b.created_at);
        return dateB - dateA;
      });

      setProjects(sortedProjects);
    } catch (err) {
      setError(err.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Handle search change
  const handleSearchChange = useCallback((value) => {
    const newParams = new URLSearchParams(searchParams);
    if (value === '') {
      newParams.delete('search');
    } else {
      newParams.set('search', value);
    }
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);

  // Filter projects: hide archived, apply search
  const activeProjects = useMemo(() => {
    return projects.filter((p) => p.archived !== true);
  }, [projects]);

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return activeProjects;
    const query = searchQuery.toLowerCase().trim();
    return activeProjects.filter((p) => p.name?.toLowerCase().includes(query));
  }, [activeProjects, searchQuery]);

  // Handlers
  const handleEditProject = (project) => {
    console.log('Edit project:', project.id);
  };

  const handleDeleteProject = (project) => {
    setProjectToDelete(project);
  };

  const confirmDelete = async () => {
    if (!projectToDelete) return;
    try {
      setDeleting(true);
      await del(`/api/projects/${projectToDelete.id}`);
      setProjectToDelete(null);
      fetchProjects();
    } catch (err) {
      setError(err.message || 'Failed to delete project');
      setDeleting(false);
    }
  };

  const cancelDelete = () => {
    setProjectToDelete(null);
  };

  const handleCreateProject = async (data) => {
    const newProject = await post('/api/projects', data);
    setShowCreateModal(false);
    navigate(`/projects/${newProject.id}`);
  };

  const isNewUser = !loading && !error && activeProjects.length === 0;
  const isReturningUser = !loading && !error && activeProjects.length > 0;

  return (
    <main className="main-content">
      <section className="dashboard">
        {/* Loading State */}
        {loading && (
          <div className="dashboard__loading-wrapper">
            <div className="dashboard__projects-grid" aria-busy="true" aria-label="Loading projects">
              {[1, 2, 3, 4].map((i) => (
                <ProjectCardSkeleton key={i} />
              ))}
            </div>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="dashboard__error">
            <p className="dashboard__error-text">{error}</p>
            <button className="dashboard__retry-btn" onClick={fetchProjects}>
              Try Again
            </button>
          </div>
        )}

        {/* New User State */}
        {isNewUser && (
          <div className="dashboard--new-user">
            <div className="dashboard__welcome-hero">
              <h1 className="dashboard__welcome-title">Welcome to CX AI Assistant for Product Managers</h1>
            </div>

            <div className="dashboard__capability-section">
              <h2 className="dashboard__capability-label">What you can do</h2>
              <div className="dashboard__capability-grid">
                <div className="dashboard__cap-row-top">
                  {CAPABILITIES.slice(0, 3).map((cap) => (
                    <CapabilityCard key={cap.id} capability={cap} mode="info" />
                  ))}
                </div>
                <div className="dashboard__cap-row-bottom">
                  {CAPABILITIES.slice(3).map((cap) => (
                    <CapabilityCard key={cap.id} capability={cap} mode="info" />
                  ))}
                </div>
              </div>
            </div>

            <div className="dashboard__cta">
              <button
                className="dashboard__cta-btn"
                onClick={() => setShowCreateModal(true)}
              >
                Create Your First Project
              </button>
            </div>
          </div>
        )}

        {/* Returning User State */}
        {isReturningUser && (
          <div className="dashboard--returning">
            <div className="dashboard__projects-header">
              <div className="dashboard__title-row">
                <h1 className="dashboard__section-title">Your Projects</h1>
                <span className="dashboard__count-badge">{activeProjects.length}</span>
              </div>
              <div className="dashboard__header-actions">
                <ProjectSearch value={searchQuery} onChange={handleSearchChange} />
                <button
                  className="dashboard__new-project-btn"
                  onClick={() => setShowCreateModal(true)}
                >
                  + New Project
                </button>
              </div>
            </div>

            {/* Hero card for most recent project */}
            {filteredProjects.length > 0 && !searchQuery.trim() && (
              <HeroProjectCard project={filteredProjects[0]} />
            )}

            {/* Other projects in 2-col grid */}
            {filteredProjects.length > (searchQuery.trim() ? 0 : 1) && (
              <div className="dashboard__projects-grid">
                {filteredProjects.slice(searchQuery.trim() ? 0 : 1).map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    lastActivity={project.lastActivity}
                    onEdit={handleEditProject}
                    onDelete={handleDeleteProject}
                  />
                ))}
              </div>
            )}

            {/* Empty search results */}
            {filteredProjects.length === 0 && searchQuery.trim() && (
              <EmptyState
                icon={
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="20" cy="20" r="12" stroke="currentColor" strokeWidth="2"/>
                    <path d="M42 42L30 30" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                }
                title="No matching projects"
                description={`No projects match "${searchQuery}". Try a different search term.`}
                actionButton={
                  <button onClick={() => handleSearchChange('')}>
                    Clear Search
                  </button>
                }
              />
            )}
          </div>
        )}

        {/* Create Project Modal */}
        {showCreateModal && (
          <Modal title="Create New Project" onClose={() => setShowCreateModal(false)} variant="form">
            <ProjectForm
              onSubmit={handleCreateProject}
              onCancel={() => setShowCreateModal(false)}
            />
          </Modal>
        )}

        {/* Delete Confirmation Modal */}
        {projectToDelete && (
          <Modal title="Delete Project" onClose={cancelDelete}>
            <div className="delete-confirmation">
              <p className="delete-confirmation__message">
                Are you sure you want to delete <strong>{projectToDelete.name}</strong>?
              </p>
              <p className="delete-confirmation__warning">
                This will permanently delete the project and all its data including requirements, PRDs, and user stories.
              </p>
              <div className="delete-confirmation__actions">
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={cancelDelete}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={confirmDelete}
                  disabled={deleting}
                >
                  {deleting ? 'Deleting...' : 'Delete Project'}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </section>
    </main>
  );
}

export default DashboardPage;
