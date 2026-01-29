import React from 'react';
import './ProjectViewSkeleton.css';

/**
 * Skeleton loading state for ProjectViewPage
 * Mimics the structure of the project view for a smooth loading experience
 */
function ProjectViewSkeleton() {
  return (
    <div className="project-view-skeleton" aria-hidden="true">
      {/* Breadcrumbs skeleton */}
      <div className="project-view-skeleton__breadcrumbs">
        <div className="project-view-skeleton__breadcrumb" />
        <div className="project-view-skeleton__breadcrumb-separator">/</div>
        <div className="project-view-skeleton__breadcrumb project-view-skeleton__breadcrumb--wide" />
        <div className="project-view-skeleton__breadcrumb-separator">/</div>
        <div className="project-view-skeleton__breadcrumb" />
      </div>

      {/* Header skeleton */}
      <div className="project-view-skeleton__header">
        <div className="project-view-skeleton__header-content">
          <div className="project-view-skeleton__title" />
          <div className="project-view-skeleton__description" />
        </div>
        <div className="project-view-skeleton__settings-btn" />
      </div>

      {/* Stage stepper skeleton */}
      <div className="project-view-skeleton__stepper">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="project-view-skeleton__step">
            <div className="project-view-skeleton__step-indicator" />
            <div className="project-view-skeleton__step-label" />
          </div>
        ))}
      </div>

      {/* Content area skeleton */}
      <div className="project-view-skeleton__content">
        {/* Stage header skeleton */}
        <div className="project-view-skeleton__stage-header">
          <div className="project-view-skeleton__stage-title" />
          <div className="project-view-skeleton__stage-subtitle" />
        </div>

        {/* Content placeholder skeleton */}
        <div className="project-view-skeleton__stage-content">
          <div className="project-view-skeleton__content-block" />
          <div className="project-view-skeleton__content-block project-view-skeleton__content-block--short" />
          <div className="project-view-skeleton__content-block project-view-skeleton__content-block--medium" />
        </div>
      </div>
    </div>
  );
}

export default ProjectViewSkeleton;
