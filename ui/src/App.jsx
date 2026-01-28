import React, { useState } from 'react'
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import ProjectsPage from './pages/ProjectsPage'
import ProjectDashboard from './pages/ProjectDashboard'
import UploadMeetingPage from './pages/UploadMeetingPage'
import RecapEditorPage from './pages/RecapEditorPage'
import RequirementsPage from './pages/RequirementsPage'
import ConflictResolverPage from './pages/ConflictResolverPage'
import PRDLandingPage from './pages/PRDLandingPage'
import PRDGeneratorPage from './pages/PRDGeneratorPage'
import PRDStreamingPage from './pages/PRDStreamingPage'
import PRDEditorPage from './pages/PRDEditorPage'
import StoriesLandingPage from './pages/StoriesLandingPage'
import UserStoriesPage from './pages/UserStoriesPage'
import DashboardPage from './pages/DashboardPage'
import ProjectViewPage from './pages/ProjectViewPage'
import QuickConvertPage from './pages/QuickConvertPage'
import QuickConvertRequirementsPage from './pages/QuickConvertRequirementsPage'
import QuickConvertPRDPage from './pages/QuickConvertPRDPage'
import './App.css'

function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()
  const isInApp = location.pathname.startsWith('/app')

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen)
  }

  const closeMobileMenu = () => {
    setMobileMenuOpen(false)
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <Link to="/dashboard" className="logo" onClick={closeMobileMenu}>
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="36" height="36" rx="8" fill="#4ECDC4"/>
              <path d="M10 13h16" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <path d="M10 18h16" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <path d="M10 23h16" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </Link>
          <div className="header-text">
            <h1>CX AI Assistant</h1>
            <span className="alpha-badge">ALPHA</span>
          </div>
        </div>

        <nav className={`header-nav ${mobileMenuOpen ? 'header-nav--open' : ''}`}>
          <Link
            to="/dashboard"
            className={`header-nav-link ${location.pathname === '/dashboard' ? 'header-nav-link--active' : ''}`}
            onClick={closeMobileMenu}
          >
            Home
          </Link>
          <Link
            to="/app"
            className={`header-nav-link ${isInApp ? 'header-nav-link--active' : ''}`}
            onClick={closeMobileMenu}
          >
            Projects
          </Link>
        </nav>

        <button
          className="mobile-menu-btn"
          onClick={toggleMobileMenu}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          )}
        </button>
      </header>

      {mobileMenuOpen && <div className="mobile-menu-overlay" onClick={closeMobileMenu} />}

      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/quick-convert" element={<QuickConvertPage />} />
          <Route path="/quick-convert/requirements" element={<QuickConvertRequirementsPage />} />
          <Route path="/quick-convert/prd" element={<QuickConvertPRDPage />} />
          <Route path="/projects/:id" element={<ProjectViewPage />} />
          <Route path="/projects/:id/:stage" element={<ProjectViewPage />} />
          <Route path="/app" element={<ProjectsPage />} />
          <Route path="/app/projects/:id" element={<ProjectDashboard />} />
          <Route path="/app/projects/:id/meetings/new" element={<UploadMeetingPage />} />
          <Route path="/app/projects/:id/meetings/:mid" element={<RecapEditorPage />} />
          <Route path="/app/projects/:id/meetings/:mid/apply" element={<ConflictResolverPage />} />
          <Route path="/app/projects/:id/requirements" element={<RequirementsPage />} />
          <Route path="/app/prd" element={<PRDLandingPage />} />
          <Route path="/app/projects/:projectId/prd/generate" element={<PRDGeneratorPage />} />
          <Route path="/app/projects/:projectId/prd/streaming" element={<PRDStreamingPage />} />
          <Route path="/app/prds/:prdId" element={<PRDEditorPage />} />
          <Route path="/app/stories" element={<StoriesLandingPage />} />
          <Route path="/app/projects/:projectId/stories" element={<UserStoriesPage />} />
          <Route path="/app/*" element={<ProjectsPage />} />
        </Routes>
      </ErrorBoundary>
    </div>
  )
}

export default App
