import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { get } from '../services/api';
import ProjectCard from '../components/projects/ProjectCard';
import StageFilter from '../components/dashboard/StageFilter';
import ProjectSearch from '../components/dashboard/ProjectSearch';
import NewProjectModal from '../components/dashboard/NewProjectModal';
import EmptyState from '../components/common/EmptyState';
import './DashboardPage.css';

/**
 * Default stage definitions for determining current stage
 */
const DEFAULT_STAGES = [
  { id: 'requirements', label: 'Requirements' },
  { id: 'prd', label: 'PRD' },
  { id: 'stories', label: 'User Stories' },
  { id: 'mockups', label: 'Mockups' },
  { id: 'export', label: 'Export' },
];

/**
 * Maps stage status to a normalized status for display
 */
function getStageStatus(stageId, project) {
  const statusMap = {
    requirements: { empty: 'empty', has_items: 'in_progress', reviewed: 'complete' },
    prd: { empty: 'empty', draft: 'in_progress', ready: 'complete' },
    stories: { empty: 'empty', generated: 'in_progress', refined: 'complete' },
    mockups: { empty: 'empty', generated: 'complete' },
    export: { not_exported: 'empty', exported: 'complete' },
  };

  const fieldMap = {
    requirements: 'requirements_status',
    prd: 'prd_status',
    stories: 'stories_status',
    mockups: 'mockups_status',
    export: 'export_status',
  };

  const fieldName = fieldMap[stageId];
  const rawStatus = project[fieldName] || 'empty';
  return statusMap[stageId]?.[rawStatus] || 'empty';
}

/**
 * Determines the current active stage based on project statuses
 * The current stage is the first incomplete stage, or the last stage if all complete
 */
function getCurrentStage(project) {
  for (const stage of DEFAULT_STAGES) {
    const status = getStageStatus(stage.id, project);
    if (status !== 'complete') {
      return stage;
    }
  }
  return DEFAULT_STAGES[DEFAULT_STAGES.length - 1];
}

/**
 * Dashboard page with welcome header, action cards, and projects section.
 * This serves as the main landing page after login.
 */
function DashboardPage() {
  // User name would come from auth context in a real app
  const userName = 'User';

  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);

  // Get filter values from URL query params
  const stageFilter = searchParams.get('stage') || 'all';
  const searchQuery = searchParams.get('search') || '';

  // Fetch projects and their stats
  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const projectList = await get('/api/projects');

      // Fetch stats for each project to get meeting count and last activity
      const projectsWithStats = await Promise.all(
        projectList.map(async (project) => {
          try {
            const stats = await get(`/api/projects/${project.id}/stats`);
            return {
              ...project,
              meetingCount: stats.meeting_count,
              lastActivity: stats.last_activity,
            };
          } catch {
            // If stats fetch fails, return project without stats
            return {
              ...project,
              meetingCount: 0,
              lastActivity: project.updated_at,
            };
          }
        })
      );

      // Sort by last updated (most recent first)
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

  // Handle filter change - update URL query param
  const handleFilterChange = useCallback((value) => {
    const newParams = new URLSearchParams(searchParams);
    if (value === 'all') {
      newParams.delete('stage');
    } else {
      newParams.set('stage', value);
    }
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);

  // Handle search change - update URL query param
  const handleSearchChange = useCallback((value) => {
    const newParams = new URLSearchParams(searchParams);
    if (value === '') {
      newParams.delete('search');
    } else {
      newParams.set('search', value);
    }
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);

  // Filter projects based on stage and search query
  const filteredProjects = useMemo(() => {
    let result = projects;

    // Filter by stage
    if (stageFilter !== 'all') {
      result = result.filter((project) => {
        const currentStage = getCurrentStage(project);
        return currentStage.id === stageFilter;
      });
    }

    // Filter by search query (case-insensitive name match)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((project) =>
        project.name?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [projects, stageFilter, searchQuery]);

  // Placeholder handlers for edit and delete
  const handleEditProject = (project) => {
    // Will be implemented in P1-009 (New Project Modal) or P2-003 (Project Settings Modal)
    console.log('Edit project:', project.id);
  };

  const handleDeleteProject = (project) => {
    // Will be implemented in P2-003 (Project Settings Modal)
    console.log('Delete project:', project.id);
  };

  return (
    <main className="main-content">
      <section className="dashboard">
        {/* Welcome Header */}
        <div className="dashboard__header">
          <h1 className="dashboard__welcome">Welcome back, {userName}</h1>
          <p className="dashboard__subtitle">What would you like to work on today?</p>
        </div>

        {/* Action Cards */}
        <div className="dashboard__actions">
          <button
            type="button"
            className="action-card action-card--primary"
            onClick={() => setShowNewProjectModal(true)}
          >
            <div className="action-card__icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 5V19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="action-card__content">
              <h3 className="action-card__title">New Project</h3>
              <p className="action-card__description">Create a new project to organize requirements, PRDs, and user stories</p>
            </div>
          </button>

          <Link to="/quick-convert" className="action-card action-card--secondary">
            <div className="action-card__icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="action-card__content">
              <h3 className="action-card__title">Quick Convert</h3>
              <p className="action-card__description">Quickly convert notes to requirements, PRDs, or user stories without saving to a project</p>
            </div>
          </Link>
        </div>

        {/* Your Projects Section */}
        <div className="dashboard__projects-section">
          <div className="dashboard__section-header">
            <h2 className="dashboard__section-title">Your Projects</h2>
            <div className="dashboard__filters">
              <ProjectSearch value={searchQuery} onChange={handleSearchChange} />
              <StageFilter value={stageFilter} onChange={handleFilterChange} />
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="dashboard__loading">
              <div className="dashboard__loading-spinner" aria-label="Loading projects">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25"/>
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <p className="dashboard__loading-text">Loading projects...</p>
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

          {/* Projects Grid */}
          {!loading && !error && filteredProjects.length > 0 && (
            <div className="dashboard__projects-grid">
              {filteredProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  meetingCount={project.meetingCount}
                  lastActivity={project.lastActivity}
                  onEdit={handleEditProject}
                  onDelete={handleDeleteProject}
                />
              ))}
            </div>
          )}

          {/* Empty State - no projects matching filter/search */}
          {!loading && !error && projects.length > 0 && filteredProjects.length === 0 && (
            <EmptyState
              icon={
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="20" cy="20" r="12" stroke="currentColor" strokeWidth="2"/>
                  <path d="M42 42L30 30" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              }
              title={searchQuery.trim() ? 'No matching projects' : 'No projects found'}
              description={
                searchQuery.trim()
                  ? `No projects match "${searchQuery}". Try a different search term or clear filters.`
                  : 'No projects match the selected stage filter. Try selecting a different stage or view all projects.'
              }
              actionButton={
                <button
                  onClick={() => {
                    handleFilterChange('all');
                    handleSearchChange('');
                  }}
                >
                  Clear Filters
                </button>
              }
            />
          )}

          {/* Empty State - no projects yet */}
          {!loading && !error && projects.length === 0 && (
            <EmptyState
              icon={
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="8" y="8" width="32" height="32" rx="4" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4"/>
                  <path d="M24 18V30" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M18 24H30" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              }
              title="No projects yet"
              description="Create your first project to start organizing requirements and generating PRDs."
              actionButton={
                <button
                  type="button"
                  className="empty-state-link-btn"
                  onClick={() => setShowNewProjectModal(true)}
                >
                  Create Project
                </button>
              }
            />
          )}
        </div>

        {/* New Project Modal */}
        {showNewProjectModal && (
          <NewProjectModal onClose={() => setShowNewProjectModal(false)} />
        )}
      </section>
    </main>
  );
}

export default DashboardPage;
