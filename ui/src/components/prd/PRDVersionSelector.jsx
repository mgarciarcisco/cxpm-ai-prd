import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { listPRDs } from '../../services/api'
import './PRDVersionSelector.css'

/**
 * Dropdown selector for switching between PRD versions
 * 
 * @param {object} props
 * @param {string} props.projectId - Project UUID to list PRDs for
 * @param {string} props.currentPrdId - Current PRD UUID (to highlight)
 * @param {number} props.currentVersion - Current PRD version number
 */
function PRDVersionSelector({ projectId, currentPrdId, currentVersion }) {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [versions, setVersions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const dropdownRef = useRef(null)

  // Fetch versions when dropdown opens
  useEffect(() => {
    if (isOpen && projectId) {
      fetchVersions()
    }
  }, [isOpen, projectId])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Close dropdown on Escape
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const fetchVersions = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await listPRDs(projectId, { limit: 50 })
      // Sort by version descending (newest first)
      const sortedVersions = (data.items || data || []).sort((a, b) => b.version - a.version)
      setVersions(sortedVersions)
    } catch (err) {
      console.error('Failed to fetch PRD versions:', err)
      setError('Failed to load versions')
    } finally {
      setLoading(false)
    }
  }

  const handleVersionSelect = (prdId) => {
    if (prdId !== currentPrdId) {
      navigate(`/app/prds/${prdId}`)
    }
    setIsOpen(false)
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const formatMode = (mode) => {
    return mode.charAt(0).toUpperCase() + mode.slice(1).toLowerCase()
  }

  return (
    <div className="prd-version-selector" ref={dropdownRef}>
      <button
        type="button"
        className="prd-version-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="prd-version-badge">v{currentVersion}</span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`prd-version-chevron ${isOpen ? 'prd-version-chevron--open' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div className="prd-version-dropdown" role="listbox">
          <div className="prd-version-dropdown-header">
            <span className="prd-version-dropdown-title">PRD Versions</span>
          </div>

          <div className="prd-version-dropdown-content">
            {loading && (
              <div className="prd-version-loading">
                <svg className="prd-version-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                </svg>
                Loading versions...
              </div>
            )}

            {error && (
              <div className="prd-version-error">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
                <button 
                  type="button" 
                  className="prd-version-retry"
                  onClick={fetchVersions}
                >
                  Retry
                </button>
              </div>
            )}

            {!loading && !error && versions.length === 0 && (
              <div className="prd-version-empty">
                No other versions found
              </div>
            )}

            {!loading && !error && versions.length > 0 && (
              <ul className="prd-version-list">
                {versions.map((prd) => (
                  <li key={prd.id}>
                    <button
                      type="button"
                      className={`prd-version-item ${prd.id === currentPrdId ? 'prd-version-item--current' : ''}`}
                      onClick={() => handleVersionSelect(prd.id)}
                      role="option"
                      aria-selected={prd.id === currentPrdId}
                    >
                      <div className="prd-version-item-main">
                        <span className="prd-version-item-version">
                          v{prd.version}
                          {prd.id === currentPrdId && (
                            <span className="prd-version-item-current-badge">Current</span>
                          )}
                        </span>
                        <span className="prd-version-item-mode">{formatMode(prd.mode)}</span>
                      </div>
                      <div className="prd-version-item-meta">
                        <span className="prd-version-item-date">{formatDate(prd.created_at)}</span>
                      </div>
                      {prd.id === currentPrdId && (
                        <span className="prd-version-item-check">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default PRDVersionSelector
