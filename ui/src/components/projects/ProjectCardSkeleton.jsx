import React from 'react';
import './ProjectCardSkeleton.css';

/**
 * Skeleton loading state for ProjectCard
 * Mimics the structure of the new full-width ProjectCard layout
 */
function ProjectCardSkeleton() {
  return (
    <div className="project-card-skeleton" aria-hidden="true">
      {/* Header */}
      <div className="project-card-skeleton__header">
        <div className="project-card-skeleton__title-section">
          <div className="project-card-skeleton__name" />
          <div className="project-card-skeleton__description" />
        </div>
        <div className="project-card-skeleton__meta">
          <div className="project-card-skeleton__time" />
          <div className="project-card-skeleton__actions">
            <div className="project-card-skeleton__action-btn" />
            <div className="project-card-skeleton__action-btn" />
          </div>
        </div>
      </div>

      {/* Progress section */}
      <div className="project-card-skeleton__progress">
        <div className="project-card-skeleton__progress-bar" />
        <div className="project-card-skeleton__stages">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="project-card-skeleton__stage" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default ProjectCardSkeleton;
