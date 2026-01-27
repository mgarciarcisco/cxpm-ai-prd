import React, { useState, useEffect } from 'react'
import Modal from '../common/Modal'
import { exportStories, listBatches } from '../../services/api'
import './StoriesExportModal.css'

/**
 * Modal for exporting user stories in various formats
 * 
 * @param {object} props
 * @param {string} props.projectId - Project UUID to export stories from
 * @param {string} props.projectName - Project name for filename
 * @param {function} props.onClose - Callback to close modal
 */
function StoriesExportModal({ projectId, projectName, onClose }) {
  const [format, setFormat] = useState('markdown')
  const [selectedBatchId, setSelectedBatchId] = useState('')
  const [batches, setBatches] = useState([])
  const [loadingBatches, setLoadingBatches] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState(null)

  const formats = [
    {
      id: 'markdown',
      name: 'Markdown',
      extension: 'md',
      description: 'Best for documentation and sharing',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
    },
    {
      id: 'csv',
      name: 'CSV',
      extension: 'csv',
      description: 'Spreadsheet format for Jira, Excel, etc.',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="3" y1="15" x2="21" y2="15" />
          <line x1="9" y1="3" x2="9" y2="21" />
          <line x1="15" y1="3" x2="15" y2="21" />
        </svg>
      ),
    },
    {
      id: 'json',
      name: 'JSON',
      extension: 'json',
      description: 'Structured data for integrations',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
          <line x1="12" y1="2" x2="12" y2="22" />
        </svg>
      ),
    },
  ]

  // Fetch batches on mount
  useEffect(() => {
    const fetchBatches = async () => {
      try {
        setLoadingBatches(true)
        const data = await listBatches(projectId)
        setBatches(data || [])
      } catch (err) {
        console.error('Failed to fetch batches:', err)
        // Non-critical - just means no batch filter available
      } finally {
        setLoadingBatches(false)
      }
    }
    fetchBatches()
  }, [projectId])

  const handleExport = async () => {
    try {
      setExporting(true)
      setError(null)

      const blob = await exportStories(projectId, format, selectedBatchId || null)
      
      // Create filename from project name
      const sanitizedName = projectName
        .replace(/[^a-z0-9\s-]/gi, '')
        .replace(/\s+/g, '-')
        .toLowerCase()
        .substring(0, 50)
      const selectedFormat = formats.find((f) => f.id === format)
      const batchSuffix = selectedBatchId ? `-batch` : ''
      const filename = `${sanitizedName || 'stories'}${batchSuffix}-stories.${selectedFormat.extension}`

      // Trigger download
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      onClose()
    } catch (err) {
      console.error('Export failed:', err)
      setError(err.message || 'Failed to export stories')
    } finally {
      setExporting(false)
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <Modal title="Export Stories" onClose={onClose}>
      <div className="stories-export-modal">
        <p className="stories-export-description">
          Choose a format to download your user stories.
        </p>

        <div className="stories-export-formats">
          {formats.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`stories-export-format-option ${format === f.id ? 'stories-export-format-option--selected' : ''}`}
              onClick={() => setFormat(f.id)}
              aria-pressed={format === f.id}
            >
              <span className="stories-export-format-icon">{f.icon}</span>
              <span className="stories-export-format-details">
                <span className="stories-export-format-name">{f.name}</span>
                <span className="stories-export-format-desc">{f.description}</span>
              </span>
              {format === f.id && (
                <span className="stories-export-format-check">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Batch Filter */}
        <div className="stories-export-batch-filter">
          <label className="stories-export-batch-label">
            Filter by Batch (Optional)
          </label>
          {loadingBatches ? (
            <div className="stories-export-batch-loading">
              <svg className="stories-export-spinner-small" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
              </svg>
              Loading batches...
            </div>
          ) : batches.length > 0 ? (
            <select
              className="stories-export-batch-select"
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
            >
              <option value="">All stories</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {formatDate(batch.created_at)} ({batch.story_count} stories, {batch.format})
                </option>
              ))}
            </select>
          ) : (
            <p className="stories-export-batch-empty">
              No batches available
            </p>
          )}
          <p className="stories-export-batch-hint">
            Leave as "All stories" to export every story in the project.
          </p>
        </div>

        {error && (
          <div className="stories-export-error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        <div className="stories-export-actions">
          <button
            type="button"
            className="stories-export-cancel-btn"
            onClick={onClose}
            disabled={exporting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="stories-export-download-btn"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? (
              <>
                <svg className="stories-export-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                </svg>
                Exporting...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default StoriesExportModal
