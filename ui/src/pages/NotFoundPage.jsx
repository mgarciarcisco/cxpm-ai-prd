import React from 'react';
import { Link } from 'react-router-dom';
import './NotFoundPage.css';

/**
 * 404 Not Found page.
 * Displayed when users navigate to an unknown route.
 */
function NotFoundPage() {
  return (
    <main className="main-content">
      <div className="not-found">
        <div className="not-found__icon">
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="3"/>
            <path d="M28 28L52 52M52 28L28 52" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
          </svg>
        </div>
        <h1 className="not-found__title">404</h1>
        <h2 className="not-found__subtitle">Page Not Found</h2>
        <p className="not-found__description">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="not-found__actions">
          <Link to="/dashboard" className="not-found__home-btn">
            Go to Dashboard
          </Link>
          <button
            className="not-found__back-btn"
            onClick={() => window.history.back()}
          >
            Go Back
          </button>
        </div>
      </div>
    </main>
  );
}

export default NotFoundPage;
