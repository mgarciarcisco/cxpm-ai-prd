import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { get, del } from '../services/api';
import ProjectCard from '../components/projects/ProjectCard';
import ProjectCardSkeleton from '../components/projects/ProjectCardSkeleton';
import StageFilter from '../components/dashboard/StageFilter';
import ProjectSearch from '../components/dashboard/ProjectSearch';
import EmptyState from '../components/common/EmptyState';
import Modal from '../components/common/Modal';
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
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

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

    // Filter by archived status and stage
    if (stageFilter === 'archived') {
      // Show only archived projects
      result = result.filter((project) => project.archived === true);
    } else {
      // Hide archived projects by default
      result = result.filter((project) => project.archived !== true);

      // Filter by stage
      if (stageFilter !== 'all') {
        result = result.filter((project) => {
          const currentStage = getCurrentStage(project);
          return currentStage.id === stageFilter;
        });
      }
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

  // Placeholder handler for edit
  const handleEditProject = (project) => {
    // Will be implemented in P1-009 (New Project Modal) or P2-003 (Project Settings Modal)
    console.log('Edit project:', project.id);
  };

  // Show delete confirmation modal
  const handleDeleteProject = (project) => {
    setProjectToDelete(project);
  };

  // Confirm and execute delete
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

  // Cancel delete
  const cancelDelete = () => {
    setProjectToDelete(null);
  };

  return (
    <main className="main-content">
      <section className="dashboard">
        {/* Welcome Header */}
        <div className="dashboard__header">
          <h1 className="dashboard__welcome">Welcome back, {userName}</h1>
          <p className="dashboard__subtitle">What would you like to work on today?</p>
        </div>

        {/* START A TASK */}
        <section className="task-section">
          <div className="section-label">Start a Task</div>

          {/* Row 1: 3 cards */}
          <div className="task-cards">
            {/* Card 1: Meeting Notes to Requirements */}
            <Link to="/quick-convert/requirements?new=1" className="task-card task-card--teal">
              <div className="task-card__icon task-card__icon--teal">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
                  <rect x="9" y="3" width="6" height="4" rx="1"/>
                  <path d="M9 12h6M9 16h4"/>
                </svg>
              </div>
              <div className="task-card__title">Convert Meeting Notes to Requirements</div>
              <div className="task-card__description">Transform raw meeting content into structured product requirements</div>
              <div className="task-card__io">
                <div className="task-card__io-label">Input</div>
                Webex transcripts, AI notes, PM notes
                <div className="task-card__io-label">Output</div>
                Structured recap with problems, requirements, risks
              </div>
            </Link>

            {/* Card 2: Generate PRD */}
            <div className="task-card task-card--orange task-card--disabled">
              <div className="task-card__icon task-card__icon--orange">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
                </svg>
              </div>
              <div className="task-card__header">
                <span className="task-card__title">Generate PRD</span>
                <span className="task-card__badge">Coming Soon</span>
              </div>
              <div className="task-card__description">Create an early PRD designed to surface clarity and gaps</div>
              <div className="task-card__io">
                <div className="task-card__io-label">Input</div>
                Meeting recap, notes, or prompt
                <div className="task-card__io-label">Output</div>
                Draft PRD for review and iteration
              </div>
            </div>

            {/* Card 3: User Stories */}
            <Link to="/quick-convert/stories?new=1" className="task-card task-card--blue">
              <div className="task-card__icon task-card__icon--blue">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" rx="1"/>
                  <rect x="14" y="3" width="7" height="7" rx="1"/>
                  <rect x="3" y="14" width="7" height="7" rx="1"/>
                  <rect x="14" y="14" width="7" height="7" rx="1"/>
                </svg>
              </div>
              <div className="task-card__title">User Stories</div>
              <div className="task-card__description">Generate actionable user stories from your requirements</div>
              <div className="task-card__io">
                <div className="task-card__io-label">Input</div>
                Requirements from meeting recap
                <div className="task-card__io-label">Output</div>
                User stories with acceptance criteria
              </div>
            </Link>
          </div>

          {/* Row 2: 2 cards */}
          <div className="task-cards-row-2">
            {/* Card 4: Recommend Features */}
            <div className="task-card task-card--purple task-card--disabled">
              <div className="task-card__icon task-card__icon--purple">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18V5l12-2v13"/>
                  <circle cx="6" cy="18" r="3"/>
                  <circle cx="18" cy="16" r="3"/>
                </svg>
              </div>
              <div className="task-card__header">
                <span className="task-card__title">Recommend Features from Feedback</span>
                <span className="task-card__badge">Coming Soon</span>
              </div>
              <div className="task-card__description">Identify patterns and opportunities from customer input</div>
              <div className="task-card__io">
                <div className="task-card__io-label">Input</div>
                Feedback, support tickets, notes
                <div className="task-card__io-label">Output</div>
                Clustered themes and recommendations
              </div>
            </div>

            {/* Card 5: Mockups */}
            <div className="task-card task-card--teal task-card--disabled">
              <div className="task-card__icon task-card__icon--teal">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <path d="M3 9h18"/>
                  <circle cx="6" cy="6" r="1" fill="currentColor"/>
                  <circle cx="9" cy="6" r="1" fill="currentColor"/>
                  <path d="M8 15l2-2 3 3 3-4 2 2"/>
                </svg>
              </div>
              <div className="task-card__header">
                <span className="task-card__title">Generate CX / AI Assistant Mockups</span>
                <span className="task-card__badge">Coming Soon</span>
              </div>
              <div className="task-card__description">Create screen flows and UI specifications for features</div>
              <div className="task-card__io">
                <div className="task-card__io-label">Input</div>
                Feature idea or PRD
                <div className="task-card__io-label">Output</div>
                Screen flows and UI specs
              </div>
            </div>

            {/* Spacer for grid alignment */}
            <div className="task-card task-card--spacer" aria-hidden="true"></div>
          </div>
        </section>

        {/* Your Projects Section */}
        <div className="dashboard__projects-section">
          <div className="dashboard__section-header">
            <h2 className="dashboard__section-title">Your Projects</h2>
            <div className="dashboard__filters">
              <ProjectSearch value={searchQuery} onChange={handleSearchChange} />
              <StageFilter value={stageFilter} onChange={handleFilterChange} />
            </div>
          </div>

          {/* Loading State - Skeleton Cards */}
          {loading && (
            <div className="dashboard__projects-grid" aria-busy="true" aria-label="Loading projects">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <ProjectCardSkeleton key={i} />
              ))}
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
              description="Start a task above to begin working on requirements, PRDs, or user stories."
            />
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {projectToDelete && (
          <Modal
            title="Delete Project"
            onClose={cancelDelete}
          >
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
