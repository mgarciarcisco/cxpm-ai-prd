import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { get } from '../services/api';
import { Breadcrumbs } from '../components/common/Breadcrumbs';
import { StageStepper } from '../components/common/StageStepper';
import ProjectSettingsModal from '../components/project/ProjectSettingsModal';
import ProjectViewSkeleton from '../components/project/ProjectViewSkeleton';
import {
  RequirementsStage,
  PRDStage,
  UserStoriesStage,
  MockupsStage,
  ExportStage,
} from '../components/stages';
import './ProjectViewPage.css';

/**
 * Project detail view page.
 * Shows dashboard with stage cards at /projects/:id
 * Shows individual stage content at /projects/:id/:stage
 */

// Stage labels for breadcrumb display
const STAGE_LABELS = {
  requirements: 'Requirements',
  prd: 'PRD',
  stories: 'User Stories',
  mockups: 'Mockups',
  export: 'Export',
};

// Map stage IDs to their corresponding components
const STAGE_COMPONENTS = {
  requirements: RequirementsStage,
  prd: PRDStage,
  stories: UserStoriesStage,
  mockups: MockupsStage,
  export: ExportStage,
};

// Stage card configuration
const STAGE_CONFIG = [
  {
    id: 'requirements',
    title: 'Requirements',
    subtitle: 'Gathered from meetings and manual input',
    icon: '📝',
    iconClass: 'stage-card__icon--requirements',
    statusMap: { empty: 'empty', has_items: 'in_progress', reviewed: 'complete' },
    getMetaText: (stats, project) => {
      const count = stats?.requirement_count ?? project?.requirements_count ?? 0;
      return `${count} item${count !== 1 ? 's' : ''}`;
    },
    getPrimaryAction: (status) => status === 'empty' ? 'Get Started' : 'View',
    getSecondaryAction: (status) => status !== 'empty' ? 'Add More' : null,
  },
  {
    id: 'prd',
    title: 'PRD',
    subtitle: 'Product Requirements Document',
    icon: '📄',
    iconClass: 'stage-card__icon--prd',
    statusMap: { empty: 'empty', draft: 'in_progress', ready: 'complete' },
    getMetaText: (stats, project, prdData) => {
      if (!prdData || prdData.total === 0) return 'Not generated';
      const latest = prdData.items?.[0];
      return latest ? `Draft v${latest.version}` : 'Draft';
    },
    getPrimaryAction: (status) => {
      if (status === 'empty') return 'Generate';
      if (status === 'in_progress') return 'Continue';
      return 'View';
    },
    getSecondaryAction: (status) => status !== 'empty' ? 'Regenerate' : null,
  },
  {
    id: 'stories',
    title: 'User Stories',
    subtitle: 'Actionable development tasks',
    icon: '📋',
    iconClass: 'stage-card__icon--stories',
    statusMap: { empty: 'empty', generated: 'in_progress', refined: 'complete' },
    getMetaText: (stats, project, prdData, storiesData) => {
      const count = storiesData?.total ?? 0;
      return `${count} stor${count === 1 ? 'y' : 'ies'}`;
    },
    getPrimaryAction: (status) => status === 'empty' ? 'Generate' : 'View',
    getSecondaryAction: () => null,
  },
  {
    id: 'mockups',
    title: 'Mockups',
    subtitle: 'UI/UX visual designs',
    icon: '🎨',
    iconClass: 'stage-card__icon--mockups',
    statusMap: { empty: 'empty', generated: 'complete' },
    getMetaText: () => '0 mockups', // TODO: implement mockups count
    getPrimaryAction: (status) => status === 'empty' ? 'Create' : 'View',
    getSecondaryAction: () => null,
  },
  {
    id: 'export',
    title: 'Export',
    subtitle: 'Download or sync to external tools',
    icon: '📦',
    iconClass: 'stage-card__icon--export',
    statusMap: { not_exported: 'empty', exported: 'complete' },
    getMetaText: (stats, project) => {
      return project?.export_status === 'exported' ? 'Exported' : 'Not exported';
    },
    getPrimaryAction: () => 'Export',
    getSecondaryAction: () => null,
  },
];

/**
 * Format relative time from a date
 */
function formatRelativeTime(dateString) {
  if (!dateString) return '—';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  if (diffMs < 0) return 'Just now';
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString();
}

/**
 * Get the status badge text based on status
 */
function getStatusBadgeText(status) {
  switch (status) {
    case 'empty': return 'Not Started';
    case 'in_progress': return 'In Progress';
    case 'complete': return 'Complete';
    default: return 'Unknown';
  }
}

/**
 * Maps backend stage statuses to unified status format (for single stage).
 */
function mapStageStatus(project, stageId) {
  if (!project) return 'empty';

  const config = STAGE_CONFIG.find(s => s.id === stageId);
  if (!config) return 'empty';

  const backendStatus = project[`${stageId === 'stories' ? 'stories' : stageId}_status`];
  return config.statusMap[backendStatus] || 'empty';
}

/**
 * Maps backend stage statuses to StageStepper status format (all stages).
 */
function mapStageStatuses(project) {
  if (!project) return {};

  // Map requirements status
  const requirementsMap = {
    empty: 'empty',
    has_items: 'in_progress',
    reviewed: 'complete',
  };

  // Map PRD status
  const prdMap = {
    empty: 'empty',
    draft: 'in_progress',
    ready: 'complete',
  };

  // Map stories status
  const storiesMap = {
    empty: 'empty',
    generated: 'in_progress',
    refined: 'complete',
  };

  // Map mockups status
  const mockupsMap = {
    empty: 'empty',
    generated: 'complete',
  };

  // Map export status
  const exportMap = {
    not_exported: 'empty',
    exported: 'complete',
  };

  return {
    requirements: requirementsMap[project.requirements_status] || 'empty',
    prd: prdMap[project.prd_status] || 'empty',
    stories: storiesMap[project.stories_status] || 'empty',
    mockups: mockupsMap[project.mockups_status] || 'empty',
    export: exportMap[project.export_status] || 'empty',
  };
}

// Valid stage IDs for URL validation
const VALID_STAGES = ['requirements', 'prd', 'stories', 'mockups', 'export'];

function ProjectViewPage() {
  const { id, stage: urlStage } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [stats, setStats] = useState(null);
  const [prdData, setPrdData] = useState(null);
  const [storiesData, setStoriesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Derive currentStage from URL
  const currentStage = urlStage && VALID_STAGES.includes(urlStage) ? urlStage : null;
  const isDashboard = !currentStage;

  const fetchProject = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const projectData = await get(`/api/projects/${id}`);
      setProject(projectData);
    } catch (err) {
      setError(err.message || 'Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchStats = useCallback(async () => {
    try {
      const statsData = await get(`/api/projects/${id}/stats`);
      setStats(statsData);
    } catch (err) {
      console.warn('Failed to fetch project stats:', err);
    }
  }, [id]);

  const fetchPrdData = useCallback(async () => {
    try {
      const data = await get(`/api/projects/${id}/prds?limit=1`);
      setPrdData(data);
    } catch (err) {
      console.warn('Failed to fetch PRD data:', err);
    }
  }, [id]);

  const fetchStoriesData = useCallback(async () => {
    try {
      const data = await get(`/api/projects/${id}/stories?limit=1`);
      setStoriesData(data);
    } catch (err) {
      console.warn('Failed to fetch stories data:', err);
    }
  }, [id]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  // Fetch additional data when on dashboard view
  useEffect(() => {
    if (isDashboard && project) {
      fetchStats();
      fetchPrdData();
      fetchStoriesData();
    }
  }, [isDashboard, project, fetchStats, fetchPrdData, fetchStoriesData]);

  const handleSettingsClick = () => {
    setShowSettingsModal(true);
  };

  const handleProjectUpdated = useCallback((updatedProject) => {
    setProject(updatedProject);
  }, []);

  const handleProjectDeleted = useCallback(() => {
    // Navigation to dashboard is handled by the modal
  }, []);

  // Handle stage card click - navigate to stage URL
  const handleStageClick = (stageId) => {
    navigate(`/projects/${id}/${stageId}`);
  };

  // Handle action button click
  const handleActionClick = (e, stageId) => {
    e.stopPropagation(); // Prevent card click
    navigate(`/projects/${id}/${stageId}`);
  };

  // Build breadcrumb items dynamically
  const getBreadcrumbItems = () => {
    const items = [
      { label: 'Dashboard', href: '/dashboard' },
    ];

    if (project) {
      if (currentStage) {
        // On stage detail page, project name links to dashboard
        items.push({ label: project.name, href: `/projects/${id}` });
        items.push({ label: STAGE_LABELS[currentStage] });
      } else {
        // On project dashboard, project name is current (no link)
        items.push({ label: project.name });
      }
    }

    return items;
  };

  // Render the current stage component (for stage detail view)
  const renderStageContent = () => {
    const StageComponent = STAGE_COMPONENTS[currentStage];
    if (!StageComponent) {
      return (
        <div className="project-view__placeholder">
          <p>Unknown stage: {currentStage}</p>
        </div>
      );
    }
    return <StageComponent project={project} onProjectUpdate={fetchProject} />;
  };

  // Render a single stage card
  const renderStageCard = (config) => {
    const status = mapStageStatus(project, config.id);
    const metaText = config.getMetaText(stats, project, prdData, storiesData);
    const primaryAction = config.getPrimaryAction(status);
    const secondaryAction = config.getSecondaryAction(status);
    const lastActivity = stats?.last_activity;

    return (
      <div
        key={config.id}
        className={`stage-card ${status === 'empty' ? 'stage-card--empty' : ''}`}
        onClick={() => handleStageClick(config.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleStageClick(config.id);
          }
        }}
      >
        <div className="stage-card__header">
          <div className={`stage-card__icon ${config.iconClass}`}>
            {config.icon}
          </div>
          <span className={`stage-card__badge stage-card__badge--${status.replace('_', '-')}`}>
            {getStatusBadgeText(status)}
          </span>
        </div>

        <h3 className="stage-card__title">{config.title}</h3>
        <p className="stage-card__subtitle">{config.subtitle}</p>

        <div className="stage-card__meta">
          <span className="stage-card__meta-item">
            <svg viewBox="0 0 16 16" fill="none">
              <path d="M4 6h8M4 10h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            {metaText}
          </span>
          <span className="stage-card__meta-item">
            <svg viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            {config.id === 'requirements' ? formatRelativeTime(lastActivity) : '—'}
          </span>
        </div>

        <div className="stage-card__actions">
          <button
            className="stage-card__btn stage-card__btn--primary"
            onClick={(e) => handleActionClick(e, config.id)}
          >
            {primaryAction}
          </button>
          {secondaryAction && (
            <button
              className="stage-card__btn stage-card__btn--secondary"
              onClick={(e) => handleActionClick(e, config.id)}
            >
              {secondaryAction}
            </button>
          )}
        </div>

        <span className="stage-card__arrow">→</span>
      </div>
    );
  };

  // Loading state - show skeleton
  if (loading) {
    return (
      <main className="main-content">
        <ProjectViewSkeleton />
      </main>
    );
  }

  // Error state
  if (error) {
    return (
      <main className="main-content">
        <div className="project-view">
          <div className="project-view__error">
            <div className="project-view__error-icon">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2"/>
                <path d="M24 16V26" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="24" cy="32" r="1.5" fill="currentColor"/>
              </svg>
            </div>
            <h2 className="project-view__error-title">Unable to load project</h2>
            <p className="project-view__error-text">{error}</p>
            <div className="project-view__error-actions">
              <button className="project-view__retry-btn" onClick={fetchProject}>
                Try Again
              </button>
              <Link to="/dashboard" className="project-view__back-link">
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Project not found
  if (!project) {
    return (
      <main className="main-content">
        <div className="project-view">
          <div className="project-view__error">
            <div className="project-view__error-icon">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2"/>
                <path d="M18 18L30 30M30 18L18 30" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <h2 className="project-view__error-title">Project not found</h2>
            <p className="project-view__error-text">
              The project you're looking for doesn't exist or has been deleted.
            </p>
            <Link to="/dashboard" className="project-view__back-link">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Requirements stage has its own full-page layout, render without wrapper
  if (currentStage === 'requirements') {
    return (
      <main className="main-content main-content--full">
        <RequirementsStage project={project} onProjectUpdate={fetchProject} />
        {/* Project Settings Modal */}
        {showSettingsModal && (
          <ProjectSettingsModal
            project={project}
            onClose={() => setShowSettingsModal(false)}
            onProjectUpdated={handleProjectUpdated}
            onProjectDeleted={handleProjectDeleted}
          />
        )}
      </main>
    );
  }

  return (
    <main className="main-content">
      <div className="project-view">
        {/* Breadcrumbs Navigation */}
        <Breadcrumbs items={getBreadcrumbItems()} />

        {/* Project Header */}
        <header className="project-view__header">
          <div className="project-view__header-content">
            <h1 className="project-view__title">{project.name}</h1>
            {project.description && (
              <p className="project-view__description">{project.description}</p>
            )}
          </div>
          <button
            className="project-view__settings-btn"
            onClick={handleSettingsClick}
            aria-label="Project settings"
            title="Project settings"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 12.5C11.3807 12.5 12.5 11.3807 12.5 10C12.5 8.61929 11.3807 7.5 10 7.5C8.61929 7.5 7.5 8.61929 7.5 10C7.5 11.3807 8.61929 12.5 10 12.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16.1667 12.5C16.0557 12.7513 16.0226 13.0302 16.0716 13.3005C16.1206 13.5708 16.2495 13.8203 16.4417 14.0167L16.4917 14.0667C16.6466 14.2215 16.7695 14.4053 16.8534 14.6076C16.9373 14.8099 16.9805 15.0268 16.9805 15.2458C16.9805 15.4649 16.9373 15.6817 16.8534 15.884C16.7695 16.0863 16.6466 16.2702 16.4917 16.425C16.3369 16.5799 16.153 16.7028 15.9507 16.7867C15.7484 16.8706 15.5316 16.9138 15.3125 16.9138C15.0935 16.9138 14.8766 16.8706 14.6743 16.7867C14.472 16.7028 14.2882 16.5799 14.1333 16.425L14.0833 16.375C13.887 16.1828 13.6375 16.0539 13.3672 16.0049C13.0969 15.9559 12.818 15.989 12.5667 16.1C12.3202 16.2056 12.1124 16.3831 11.9699 16.6097C11.8273 16.8363 11.7564 17.1015 11.7667 17.3667V17.5C11.7667 17.942 11.5911 18.366 11.2785 18.6785C10.966 18.9911 10.542 19.1667 10.1 19.1667C9.65798 19.1667 9.23406 18.9911 8.92149 18.6785C8.60893 18.366 8.43335 17.942 8.43335 17.5V17.425C8.41831 17.1512 8.33587 16.8859 8.19456 16.6545C8.05325 16.4232 7.85758 16.2332 7.62502 16.1C7.37375 15.989 7.09485 15.9559 6.82452 16.0049C6.5542 16.0539 6.30479 16.1828 6.10835 16.375L6.05835 16.425C5.90354 16.5799 5.71965 16.7028 5.51736 16.7867C5.31507 16.8706 5.09822 16.9138 4.87919 16.9138C4.66015 16.9138 4.44331 16.8706 4.24101 16.7867C4.03872 16.7028 3.85484 16.5799 3.70002 16.425C3.54513 16.2702 3.42218 16.0863 3.33829 15.884C3.2544 15.6817 3.21123 15.4649 3.21123 15.2458C3.21123 15.0268 3.2544 14.8099 3.33829 14.6076C3.42218 14.4053 3.54513 14.2215 3.70002 14.0667L3.75002 14.0167C3.94216 13.8203 4.07106 13.5708 4.12009 13.3005C4.16912 13.0302 4.13599 12.7513 4.02502 12.5C3.91944 12.2535 3.74185 12.0457 3.51525 11.9031C3.28865 11.7606 3.02352 11.6896 2.75835 11.7H2.62502C2.18299 11.7 1.75907 11.5244 1.4465 11.2118C1.13394 10.8993 0.958354 10.4754 0.958354 10.0333C0.958354 9.59131 1.13394 9.16739 1.4465 8.85482C1.75907 8.54226 2.18299 8.36667 2.62502 8.36667H2.70002C2.97383 8.35164 3.23911 8.2692 3.47045 8.12789C3.70178 7.98658 3.89173 7.7909 4.02502 7.55834C4.13599 7.30707 4.16912 7.02817 4.12009 6.75784C4.07106 6.48752 3.94216 6.23811 3.75002 6.04167L3.70002 5.99167C3.54513 5.83686 3.42218 5.65297 3.33829 5.45068C3.2544 5.24839 3.21123 5.03154 3.21123 4.81251C3.21123 4.59347 3.2544 4.37663 3.33829 4.17433C3.42218 3.97204 3.54513 3.78816 3.70002 3.63334C3.85484 3.47845 4.03872 3.35551 4.24101 3.27162C4.44331 3.18772 4.66015 3.14456 4.87919 3.14456C5.09822 3.14456 5.31507 3.18772 5.51736 3.27162C5.71965 3.35551 5.90354 3.47845 6.05835 3.63334L6.10835 3.68334C6.30479 3.87548 6.5542 4.00438 6.82452 4.05341C7.09485 4.10244 7.37375 4.06931 7.62502 3.95834H7.70835C7.9549 3.85277 8.16265 3.67517 8.30522 3.44857C8.44778 3.22198 8.5187 2.95684 8.50835 2.69167V2.5C8.50835 2.05798 8.68394 1.63405 8.9965 1.32149C9.30907 1.00893 9.73299 0.833344 10.175 0.833344C10.617 0.833344 11.041 1.00893 11.3535 1.32149C11.6661 1.63405 11.8417 2.05798 11.8417 2.5V2.575C11.8313 2.84017 11.9023 3.10531 12.0448 3.3319C12.1874 3.5585 12.3951 3.7361 12.6417 3.84167C12.8929 3.95264 13.1718 3.98577 13.4422 3.93674C13.7125 3.88771 13.9619 3.75881 14.1583 3.56667L14.2083 3.51667C14.3632 3.36179 14.547 3.23884 14.7493 3.15495C14.9516 3.07105 15.1685 3.02789 15.3875 3.02789C15.6065 3.02789 15.8234 3.07105 16.0257 3.15495C16.228 3.23884 16.4119 3.36179 16.5667 3.51667C16.7216 3.67149 16.8445 3.85537 16.9284 4.05766C17.0123 4.25996 17.0555 4.4768 17.0555 4.69584C17.0555 4.91488 17.0123 5.13172 16.9284 5.33401C16.8445 5.53631 16.7216 5.72019 16.5667 5.87501L16.5167 5.92501C16.3246 6.12145 16.1957 6.37086 16.1466 6.64118C16.0976 6.91151 16.1307 7.19041 16.2417 7.44167V7.52501C16.3473 7.77156 16.5249 7.97931 16.7515 8.12188C16.9781 8.26444 17.2432 8.33536 17.5084 8.32501H17.6417C18.0837 8.32501 18.5076 8.5006 18.8202 8.81316C19.1328 9.12573 19.3084 9.54965 19.3084 9.99167C19.3084 10.4337 19.1328 10.8576 18.8202 11.1702C18.5076 11.4828 18.0837 11.6583 17.6417 11.6583H17.5667C17.3015 11.648 17.0364 11.7189 16.8098 11.8615C16.5832 12.0041 16.4056 12.2118 16.3 12.4583L16.1667 12.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </header>

        {/* Dashboard View - Stage Cards Grid */}
        {isDashboard && (
          <section className="project-view__stages">
            <h2 className="project-view__section-title">Project Stages</h2>
            <div className="stages-grid">
              {STAGE_CONFIG.map(renderStageCard)}
            </div>
          </section>
        )}

        {/* Stage Detail View - shows StageStepper and stage content */}
        {!isDashboard && (
          <>
            <StageStepper
              statuses={mapStageStatuses(project)}
              currentStage={currentStage}
              onStageClick={handleStageClick}
            />
            <div className="project-view__content">
              {renderStageContent()}
            </div>
          </>
        )}
      </div>

      {/* Project Settings Modal */}
      {showSettingsModal && (
        <ProjectSettingsModal
          project={project}
          onClose={() => setShowSettingsModal(false)}
          onProjectUpdated={handleProjectUpdated}
          onProjectDeleted={handleProjectDeleted}
        />
      )}
    </main>
  );
}

export default ProjectViewPage;
