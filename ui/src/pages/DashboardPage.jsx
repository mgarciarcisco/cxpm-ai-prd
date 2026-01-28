import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { get } from '../services/api';
import ProjectCard from '../components/projects/ProjectCard';
import './DashboardPage.css';

/**
 * Dashboard page with welcome header, action cards, and projects section.
 * This serves as the main landing page after login.
 */
function DashboardPage() {
  // User name would come from auth context in a real app
  const userName = 'User';

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
          <Link to="/app" className="action-card action-card--primary">
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
          </Link>

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
          {!loading && !error && projects.length > 0 && (
            <div className="dashboard__projects-grid">
              {projects.map((project) => (
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

          {/* Empty State - no projects yet */}
          {!loading && !error && projects.length === 0 && (
            <div className="dashboard__empty">
              <div className="dashboard__empty-icon">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="8" y="8" width="32" height="32" rx="4" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4"/>
                  <path d="M24 18V30" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M18 24H30" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <h3 className="dashboard__empty-title">No projects yet</h3>
              <p className="dashboard__empty-description">
                Create your first project to start organizing requirements and generating PRDs.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export default DashboardPage;
