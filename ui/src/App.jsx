import React, { useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { ToastProvider } from './contexts/ToastContext'
import OfflineIndicator from './components/common/OfflineIndicator'
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
    <ToastProvider>
    <div className="app">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <OfflineIndicator />
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

      <main id="main-content">
      <ErrorBoundary>
        <Outlet />
      </ErrorBoundary>
      </main>
    </div>
    </ToastProvider>
  )
}

export default App
