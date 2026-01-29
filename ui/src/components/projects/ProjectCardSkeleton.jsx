import React from 'react';
import './ProjectCardSkeleton.css';

/**
 * Skeleton loading state for ProjectCard
 * Mimics the structure of ProjectCard for a smooth loading experience
 */
function ProjectCardSkeleton() {
  return (
    <div className="project-card-skeleton" aria-hidden="true">
      {/* Header */}
      <div className="project-card-skeleton__header">
        <div className="project-card-skeleton__name" />
        <div className="project-card-skeleton__actions">
          <div className="project-card-skeleton__action-btn" />
          <div className="project-card-skeleton__action-btn" />
        </div>
      </div>

      {/* Description - two lines */}
      <div className="project-card-skeleton__description">
        <div className="project-card-skeleton__text-line project-card-skeleton__text-line--full" />
        <div className="project-card-skeleton__text-line project-card-skeleton__text-line--partial" />
      </div>

      {/* Progress section */}
      <div className="project-card-skeleton__progress">
        <div className="project-card-skeleton__dots">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="project-card-skeleton__dot" />
          ))}
        </div>
        <div className="project-card-skeleton__progress-info">
          <div className="project-card-skeleton__badge" />
          <div className="project-card-skeleton__percent" />
        </div>
      </div>

      {/* Footer */}
      <div className="project-card-skeleton__footer">
        <div className="project-card-skeleton__stat" />
        <div className="project-card-skeleton__stat" />
      </div>
    </div>
  );
}

export default ProjectCardSkeleton;
