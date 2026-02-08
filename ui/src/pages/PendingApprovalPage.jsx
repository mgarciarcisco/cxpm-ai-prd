import React from 'react';
import { Link } from 'react-router-dom';
import './PendingApprovalPage.css';

/**
 * Shown to users after registration when their account is pending admin approval.
 */
export default function PendingApprovalPage() {
  return (
    <div className="pending-page">
      <div className="pending-container">
        <div className="pending-branding">
          <div className="pending-logo">
            <span>&#10038;</span>
          </div>
          <h1>CX AI Assistant for Product Managers</h1>
          <p>Early Access</p>
        </div>

        <div className="pending-card">
          <div className="pending-icon">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="22" stroke="#4ECDC4" strokeWidth="2.5" fill="none" />
              <path d="M24 14v12l8 4" stroke="#4ECDC4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2>Your account is pending approval</h2>
          <p className="pending-message">
            An administrator will review your registration request.
            Please try logging in again later.
          </p>
        </div>

        <div className="pending-footer">
          <Link to="/login">Back to Login</Link>
        </div>
      </div>
    </div>
  );
}
