import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Spinner styles for the loading state.
 * Uses a simple CSS border-based spinner in the app's teal accent color.
 */
const spinnerContainerStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  backgroundColor: '#F7F8FA',
};

const spinnerStyle = {
  width: '40px',
  height: '40px',
  border: '3px solid #E5E7EB',
  borderTopColor: '#4ECDC4',
  borderRadius: '50%',
  animation: 'protectedRouteSpinner 0.7s linear infinite',
};

/**
 * ProtectedRoute component — guards child routes behind authentication.
 *
 * - While auth state is loading, shows a centered teal spinner.
 * - If not authenticated, redirects to /login.
 * - If authenticated, renders children.
 */
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <>
        <style>{`
          @keyframes protectedRouteSpinner {
            to { transform: rotate(360deg); }
          }
        `}</style>
        <div style={spinnerContainerStyle}>
          <div style={spinnerStyle} />
        </div>
      </>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
