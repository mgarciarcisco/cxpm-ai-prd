import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getPRD, updatePRD } from '../services/api'
import LoadingSpinner from '../components/common/LoadingSpinner'
import PRDExportModal from '../components/prd/PRDExportModal'
import PRDVersionSelector from '../components/prd/PRDVersionSelector'
import './PRDEditorPage.css'

const DEBOUNCE_DELAY_MS = 1000

function PRDEditorPage() {
  const { prdId } = useParams()

  // PRD data state
  const [prd, setPrd] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Edit state
  const [editedTitle, setEditedTitle] = useState('')
  const [editedSections, setEditedSections] = useState([])
  const [expandedSections, setExpandedSections] = useState(new Set())

  // Save state
  const [saveStatus, setSaveStatus] = useState('saved') // 'saved', 'saving', 'error', 'unsaved'
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Modal state
  const [showExportModal, setShowExportModal] = useState(false)

  // Refs
  const saveTimeoutRef = useRef(null)
  const sectionRefs = useRef({})

  // Fetch PRD on mount
  useEffect(() => {
    fetchPRD()
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [prdId])

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = ''
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [hasUnsavedChanges])

  const fetchPRD = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getPRD(prdId)
      setPrd(data)
      setEditedTitle(data.title || '')
      setEditedSections(data.sections || [])
      // Expand all sections by default
      setExpandedSections(new Set((data.sections || []).map((_, idx) => idx)))
      setSaveStatus('saved')
      setHasUnsavedChanges(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Auto-save with debounce
  const saveChanges = useCallback(async (title, sections) => {
    try {
      setSaveStatus('saving')
      await updatePRD(prdId, { title, sections })
      setSaveStatus('saved')
      setHasUnsavedChanges(false)
    } catch (err) {
      console.error('Failed to save PRD:', err)
      setSaveStatus('error')
    }
  }, [prdId])

  const debouncedSave = useCallback((title, sections) => {
    setHasUnsavedChanges(true)
    setSaveStatus('unsaved')
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      saveChanges(title, sections)
    }, DEBOUNCE_DELAY_MS)
  }, [saveChanges])

  // Handle title change
  const handleTitleChange = (e) => {
    const newTitle = e.target.value
    setEditedTitle(newTitle)
    debouncedSave(newTitle, editedSections)
  }

  // Handle section content change
  const handleSectionChange = (index, newContent) => {
    const newSections = editedSections.map((section, idx) =>
      idx === index ? { ...section, content: newContent } : section
    )
    setEditedSections(newSections)
    debouncedSave(editedTitle, newSections)
  }

  // Toggle section expand/collapse
  const toggleSection = (index) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
  }

  // Expand all sections
  const expandAll = () => {
    setExpandedSections(new Set(editedSections.map((_, idx) => idx)))
  }

  // Collapse all sections
  const collapseAll = () => {
    setExpandedSections(new Set())
  }

  // Scroll to section
  const scrollToSection = (index) => {
    const sectionElement = sectionRefs.current[index]
    if (sectionElement) {
      sectionElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
      // Ensure the section is expanded
      setExpandedSections((prev) => new Set([...prev, index]))
    }
  }

  // Format section title for display
  const formatSectionTitle = (title) => {
    return title
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase())
  }

  // Compute are all expanded
  const allExpanded = useMemo(() => {
    return editedSections.length > 0 && expandedSections.size === editedSections.length
  }, [editedSections.length, expandedSections.size])

  // Save status indicator
  const renderSaveStatus = () => {
    switch (saveStatus) {
      case 'saving':
        return (
          <span className="prd-save-status prd-save-status--saving">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="prd-save-spinner">
              <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
            </svg>
            Saving...
          </span>
        )
      case 'saved':
        return (
          <span className="prd-save-status prd-save-status--saved">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Saved
          </span>
        )
      case 'error':
        return (
          <span className="prd-save-status prd-save-status--error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            Error saving
          </span>
        )
      case 'unsaved':
        return (
          <span className="prd-save-status prd-save-status--unsaved">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
            </svg>
            Unsaved changes
          </span>
        )
      default:
        return null
    }
  }

  // Loading state
  if (loading) {
    return (
      <main className="main-content">
        <div className="prd-editor-loading">
          <LoadingSpinner />
          <p>Loading PRD...</p>
        </div>
      </main>
    )
  }

  // Error state
  if (error) {
    return (
      <main className="main-content">
        <section className="prd-editor-section">
          <div className="prd-editor-header">
            <h2>PRD Editor</h2>
            <Link to="/app/prd" className="back-link">Back to PRD</Link>
          </div>
          <div className="prd-editor-error">
            <p>Error loading PRD: {error}</p>
            <button onClick={fetchPRD} className="retry-btn">Retry</button>
          </div>
        </section>
      </main>
    )
  }

  // PRD not found
  if (!prd) {
    return (
      <main className="main-content">
        <section className="prd-editor-section">
          <div className="prd-editor-header">
            <h2>PRD Editor</h2>
            <Link to="/app/prd" className="back-link">Back to PRD</Link>
          </div>
          <div className="prd-editor-error">
            <p>PRD not found</p>
            <Link to="/app/prd" className="retry-btn">Go to PRD</Link>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="main-content">
      <div className="prd-editor-layout">
        {/* Sidebar - Table of Contents */}
        <aside className="prd-editor-sidebar">
          <div className="prd-sidebar-header">
            <h3 className="prd-sidebar-title">Contents</h3>
            <button
              className="prd-expand-btn"
              onClick={allExpanded ? collapseAll : expandAll}
              title={allExpanded ? 'Collapse all' : 'Expand all'}
              type="button"
            >
              {allExpanded ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4 14 10 14 10 20" />
                  <polyline points="20 10 14 10 14 4" />
                  <line x1="14" y1="10" x2="21" y2="3" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 3 21 3 21 9" />
                  <polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              )}
            </button>
          </div>
          <nav className="prd-sidebar-nav">
            <ul className="prd-toc-list">
              {editedSections.map((section, index) => (
                <li key={index} className="prd-toc-item">
                  <button
                    className={`prd-toc-link ${expandedSections.has(index) ? 'prd-toc-link--active' : ''}`}
                    onClick={() => scrollToSection(index)}
                    type="button"
                  >
                    <span className="prd-toc-number">{index + 1}</span>
                    <span className="prd-toc-text">{formatSectionTitle(section.title)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <div className="prd-sidebar-footer">
            <Link to={`/app/projects/${prd.project_id}/prd/generate`} className="prd-back-link">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              Back to Generator
            </Link>
          </div>
        </aside>

        {/* Main Content */}
        <div className="prd-editor-main">
          <div className="prd-editor-header">
            <div className="prd-editor-header-top">
              <div className="prd-editor-meta">
                <PRDVersionSelector
                  projectId={prd.project_id}
                  currentPrdId={prd.id}
                  currentVersion={prd.version}
                />
                <span className={`prd-mode-badge prd-mode-badge--${prd.mode}`}>{prd.mode}</span>
              </div>
              <div className="prd-editor-header-actions">
                {renderSaveStatus()}
                <button
                  type="button"
                  className="prd-export-btn"
                  onClick={() => setShowExportModal(true)}
                  title="Export PRD"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Export
                </button>
              </div>
            </div>
            <input
              type="text"
              className="prd-title-input"
              value={editedTitle}
              onChange={handleTitleChange}
              placeholder="PRD Title"
              aria-label="PRD Title"
            />
          </div>

          <div className="prd-sections">
            {editedSections.map((section, index) => (
              <div
                key={index}
                className="prd-section"
                ref={(el) => (sectionRefs.current[index] = el)}
              >
                <button
                  className="prd-section-header"
                  onClick={() => toggleSection(index)}
                  aria-expanded={expandedSections.has(index)}
                  type="button"
                >
                  <span className="prd-section-icon">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className={`prd-section-chevron ${expandedSections.has(index) ? 'prd-section-chevron--expanded' : ''}`}
                    >
                      <path
                        d="M6 12L10 8L6 4"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span className="prd-section-number">{index + 1}</span>
                  <span className="prd-section-title">{formatSectionTitle(section.title)}</span>
                </button>
                {expandedSections.has(index) && (
                  <div className="prd-section-content">
                    <textarea
                      className="prd-section-editor"
                      value={section.content}
                      onChange={(e) => handleSectionChange(index, e.target.value)}
                      placeholder={`Enter content for ${formatSectionTitle(section.title)}...`}
                      rows={10}
                      aria-label={`Content for ${formatSectionTitle(section.title)}`}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <PRDExportModal
          prdId={prd.id}
          prdTitle={prd.title || `PRD v${prd.version}`}
          onClose={() => setShowExportModal(false)}
        />
      )}
    </main>
  )
}

export default PRDEditorPage
