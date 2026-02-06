import React from 'react';
import { Link } from 'react-router-dom';

export default function AccessDeniedPage() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 'calc(100vh - 72px)',
      padding: '2rem',
    }}>
      <div style={{
        textAlign: 'center',
        maxWidth: 420,
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: 16,
        padding: '2.5rem 2rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="22" stroke="#DC2626" strokeWidth="2.5" fill="none" />
            <path d="M16 16l16 16M32 16L16 32" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#1F2937', marginBottom: '0.5rem' }}>Access Denied</h2>
        <p style={{ fontSize: '0.875rem', color: '#6B7280', marginBottom: '1.5rem', lineHeight: 1.6 }}>
          You don't have permission to access the admin area.
        </p>
        <Link to="/dashboard" style={{
          color: '#4ECDC4',
          textDecoration: 'none',
          fontWeight: 500,
          fontSize: '0.875rem',
        }}>Back to Dashboard</Link>
      </div>
    </div>
  );
}
