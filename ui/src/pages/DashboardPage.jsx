import React from 'react';
import { Link } from 'react-router-dom';
import './DashboardPage.css';

/**
 * Dashboard page with welcome header, action cards, and projects section.
 * This serves as the main landing page after login.
 */
function DashboardPage() {
  // User name would come from auth context in a real app
  const userName = 'User';

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
          {/* Project grid will be implemented in P1-008b */}
          <div className="dashboard__projects-placeholder">
            <p>Project list will appear here</p>
          </div>
        </div>
      </section>
    </main>
  );
}

export default DashboardPage;
