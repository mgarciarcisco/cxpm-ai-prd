import React from 'react'
import { Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import ProjectsPage from './pages/ProjectsPage'
import ProjectDashboard from './pages/ProjectDashboard'
import './App.css'

function App() {
  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <div className="logo">
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="36" height="36" rx="8" fill="#4ECDC4"/>
              <path d="M10 13h16" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <path d="M10 18h16" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <path d="M10 23h16" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="header-text">
            <h1>CX AI Assistant for Product Management</h1>
            <span className="alpha-badge">ALPHA</span>
          </div>
        </div>
      </header>

      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/app" element={<ProjectsPage />} />
        <Route path="/app/projects/:id" element={<ProjectDashboard />} />
        <Route path="/app/*" element={<ProjectsPage />} />
      </Routes>
    </div>
  )
}

export default App
