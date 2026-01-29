import React from 'react'
import { Outlet, Link } from 'react-router-dom'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { ToastProvider } from './contexts/ToastContext'
import OfflineIndicator from './components/common/OfflineIndicator'
import './App.css'

function App() {
  return (
    <ToastProvider>
    <div className="app">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <OfflineIndicator />
      <header className="header">
        <Link to="/dashboard" className="logo">
          <div className="logo-icon">
            <span className="logo-icon__symbol">✦</span>
          </div>
          <div className="header-text">
            <h1>CX AI Assistant</h1>
            <span className="header-subtitle">Early Access</span>
          </div>
        </Link>

        <div className="header-actions">
          <div className="header-avatar">
            <span>U</span>
          </div>
        </div>
      </header>

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
