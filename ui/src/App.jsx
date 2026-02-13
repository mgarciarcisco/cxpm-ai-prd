import React, { useState, useRef, useEffect } from 'react'
import { Outlet, Link } from 'react-router-dom'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { ToastProvider } from './contexts/ToastContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { NotificationProvider } from './contexts/NotificationContext'
import ProtectedRoute from './components/common/ProtectedRoute'
import NotificationBell from './components/common/NotificationBell'
import BugReportButton from './components/common/BugReportButton'
import OfflineIndicator from './components/common/OfflineIndicator'
import ProfileModal from './components/common/ProfileModal'
import './App.css'

function AppContent() {
  const { user, logout } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const dropdownRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'U'

  return (
    <div className="app">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <OfflineIndicator />
      <header className="header">
        <Link to="/dashboard" className="logo">
          <div className="logo-icon">
            <span className="logo-icon__symbol">✦</span>
          </div>
          <div className="header-text">
            <h1>CX AI Assistant for Product Managers</h1>
            <span className="header-subtitle">Prototype</span>
          </div>
        </Link>

        <div className="header-actions" ref={dropdownRef}>
          <NotificationBell />
          <button
            className="user-button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            aria-expanded={dropdownOpen}
            aria-haspopup="true"
          >
            <div className="header-avatar">
              <span>{userInitial}</span>
            </div>
            {user && <span className="user-name">{user.name}</span>}
            <svg className="user-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {dropdownOpen && (
            <div className="user-dropdown">
              <div className="dropdown-header">
                <div className="dropdown-name">{user?.name}</div>
                <div className="dropdown-email">{user?.email}</div>
              </div>
              {user?.is_admin && (
                <Link to="/admin" className="dropdown-item" onClick={() => setDropdownOpen(false)}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 1l2 3h3l-1 3 2 2-3 1-1 3-2-2-2 2-1-3-3-1 2-2-1-3h3z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Admin
                </Link>
              )}
              <Link to="/my-bugs" className="dropdown-item" onClick={() => setDropdownOpen(false)}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M8 5v3M8 10h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                My Bug Reports
              </Link>
              <Link to="/feature-requests" className="dropdown-item" onClick={() => setDropdownOpen(false)}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2v12M5 5l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Feature Requests
              </Link>
              <button className="dropdown-item" onClick={() => { setShowProfile(true); setDropdownOpen(false); }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="5.5" r="3" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M2 14c0-2.761 2.686-5 6-5s6 2.239 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Profile
              </button>
              <button className="dropdown-item dropdown-item--danger" onClick={() => { logout(); setDropdownOpen(false); }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M6 2h4M2 4h12M12.667 4l-.467 7.467a2 2 0 01-1.995 1.866H5.795a2 2 0 01-1.995-1.866L3.333 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </header>

      <main id="main-content">
        <ErrorBoundary>
          <ProtectedRoute>
            <Outlet />
          </ProtectedRoute>
        </ErrorBoundary>
      </main>
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
      <BugReportButton />
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <NotificationProvider>
          <AppContent />
        </NotificationProvider>
      </ToastProvider>
    </AuthProvider>
  )
}

export default App
