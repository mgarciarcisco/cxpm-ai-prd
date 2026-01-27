import React, { useState } from 'react'
import Modal from '../common/Modal'
import { exportPRD } from '../../services/api'
import './PRDExportModal.css'

/**
 * Modal for exporting a PRD in various formats
 * 
 * @param {object} props
 * @param {string} props.prdId - PRD UUID to export
 * @param {string} props.prdTitle - PRD title for filename
 * @param {function} props.onClose - Callback to close modal
 */
function PRDExportModal({ prdId, prdTitle, onClose }) {
  const [format, setFormat] = useState('markdown')
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

  const handleExport = async () => {
    try {
      setExporting(true)
      setError(null)

      const blob = await exportPRD(prdId, format)
      
      // Create filename from PRD title
      const sanitizedTitle = prdTitle
        .replace(/[^a-z0-9\s-]/gi, '')
        .replace(/\s+/g, '-')
        .toLowerCase()
        .substring(0, 50)
      const selectedFormat = formats.find((f) => f.id === format)
      const filename = `${sanitizedTitle || 'prd'}.${selectedFormat.extension}`

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
      setError(err.message || 'Failed to export PRD')
    } finally {
      setExporting(false)
    }
  }

  return (
    <Modal title="Export PRD" onClose={onClose}>
      <div className="prd-export-modal">
        <p className="prd-export-description">
          Choose a format to download your PRD document.
        </p>

        <div className="prd-export-formats">
          {formats.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`prd-export-format-option ${format === f.id ? 'prd-export-format-option--selected' : ''}`}
              onClick={() => setFormat(f.id)}
              aria-pressed={format === f.id}
            >
              <span className="prd-export-format-icon">{f.icon}</span>
              <span className="prd-export-format-details">
                <span className="prd-export-format-name">{f.name}</span>
                <span className="prd-export-format-desc">{f.description}</span>
              </span>
              {format === f.id && (
                <span className="prd-export-format-check">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
              )}
            </button>
          ))}
        </div>

        {error && (
          <div className="prd-export-error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        <div className="prd-export-actions">
          <button
            type="button"
            className="prd-export-cancel-btn"
            onClick={onClose}
            disabled={exporting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="prd-export-download-btn"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? (
              <>
                <svg className="prd-export-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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

export default PRDExportModal
