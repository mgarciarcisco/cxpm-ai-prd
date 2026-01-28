import React from 'react';
import { StageHeader } from '../stage/StageHeader';
import './StageContent.css';
import './ExportStage.css';

/**
 * Map export status to stage header status format.
 */
function mapExportStatus(status) {
  const statusMap = {
    not_exported: 'empty',
    exported: 'complete',
  };
  return statusMap[status] || 'empty';
}

/**
 * Map export status to human-readable label.
 */
function getStatusLabel(status) {
  const labelMap = {
    not_exported: 'Not Exported',
    exported: 'Exported',
  };
  return labelMap[status] || 'Not Exported';
}

/**
 * Export stage content component.
 * Shows export options for project data in various formats.
 */
function ExportStage({ project }) {
  const exportCards = [
    {
      id: 'markdown',
      title: 'Export as Markdown',
      description: 'Download all project artifacts as Markdown files in a ZIP archive.',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M8 13H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <path d="M8 17H12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      ),
      color: 'green',
    },
    {
      id: 'json',
      title: 'Export as JSON',
      description: 'Download the complete project data in JSON format for integration with other tools.',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 18L22 12L16 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M8 6L2 12L8 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      color: 'blue',
    },
  ];

  const integrationCards = [
    {
      id: 'jira',
      title: 'Jira Integration',
      description: 'Export user stories directly to your Jira project as issues.',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      color: 'jira',
      comingSoon: true,
    },
  ];

  const handleExportClick = (cardId) => {
    console.log(`Export as ${cardId} clicked for project:`, project?.id);
    // Export functionality will be implemented in P5-010 and P5-011
  };

  return (
    <div className="stage-content stage-content--export">
      <StageHeader
        title="Export"
        subtitle="Download your project data or integrate with external tools"
        status={mapExportStatus(project?.export_status)}
        statusLabel={getStatusLabel(project?.export_status)}
      />

      {/* Export Options Section */}
      <section className="export-stage__section">
        <h2 className="export-stage__section-title">Download Options</h2>
        <div className="export-stage__cards">
          {exportCards.map((card) => (
            <button
              key={card.id}
              className={`export-card export-card--${card.color}`}
              onClick={() => handleExportClick(card.id)}
              type="button"
            >
              <div className="export-card__icon">
                {card.icon}
              </div>
              <div className="export-card__content">
                <h3 className="export-card__title">{card.title}</h3>
                <p className="export-card__description">{card.description}</p>
              </div>
              <div className="export-card__action">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10 3V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M6 9L10 13L14 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M4 17H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Integrations Section */}
      <section className="export-stage__section">
        <h2 className="export-stage__section-title">Integrations</h2>
        <div className="export-stage__cards">
          {integrationCards.map((card) => (
            <div
              key={card.id}
              className={`export-card export-card--${card.color} ${card.comingSoon ? 'export-card--disabled' : ''}`}
            >
              <div className="export-card__icon">
                {card.icon}
              </div>
              <div className="export-card__content">
                <h3 className="export-card__title">
                  {card.title}
                  {card.comingSoon && (
                    <span className="export-card__badge">Coming Soon</span>
                  )}
                </h3>
                <p className="export-card__description">{card.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default ExportStage;
