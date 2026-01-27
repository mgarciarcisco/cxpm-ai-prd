import React, { useState, useEffect, useRef } from 'react'
import Modal from '../common/Modal'
import { listBatches, deleteBatch } from '../../services/api'
import './StoryBatchFilter.css'

/**
 * Dropdown filter for story generation batches
 * Allows filtering stories by batch and deleting batches
 * 
 * @param {object} props
 * @param {string} props.projectId - Project UUID
 * @param {string|null} props.selectedBatchId - Currently selected batch ID or null for all stories
 * @param {function} props.onBatchChange - Callback when batch selection changes
 * @param {function} props.onBatchDeleted - Callback when a batch is deleted (to refresh stories)
 */
function StoryBatchFilter({ projectId, selectedBatchId, onBatchChange, onBatchDeleted }) {
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [batchToDelete, setBatchToDelete] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  const dropdownRef = useRef(null)

  // Fetch batches on mount and when projectId changes
  useEffect(() => {
    fetchBatches()
  }, [projectId])

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen])

  const fetchBatches = async () => {
    try {
      setLoading(true)
      const data = await listBatches(projectId)
      setBatches(data || [])
    } catch (err) {
      console.error('Failed to fetch batches:', err)
      setBatches([])
    } finally {
      setLoading(false)
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

  const formatBatchLabel = (batch) => {
    return `${formatDate(batch.created_at)} (${batch.story_count} ${batch.story_count === 1 ? 'story' : 'stories'}, ${batch.format === 'classic' ? 'Classic' : 'Job Story'})`
  }

  const handleSelectBatch = (batchId) => {
    onBatchChange(batchId)
    setIsOpen(false)
  }

  const handleDeleteClick = (e, batch) => {
    e.stopPropagation()
    setBatchToDelete(batch)
    setShowDeleteConfirm(true)
    setDeleteError(null)
  }

  const handleConfirmDelete = async () => {
    if (!batchToDelete) return

    try {
      setIsDeleting(true)
      setDeleteError(null)
      await deleteBatch(projectId, batchToDelete.id)
      
      // If we deleted the currently selected batch, reset to all
      if (selectedBatchId === batchToDelete.id) {
        onBatchChange(null)
      }
      
      // Close modal and refresh
      setShowDeleteConfirm(false)
      setBatchToDelete(null)
      fetchBatches()
      
      // Notify parent to refresh stories
      if (onBatchDeleted) {
        onBatchDeleted(batchToDelete.id)
      }
    } catch (err) {
      console.error('Failed to delete batch:', err)
      setDeleteError(err.message || 'Failed to delete batch')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false)
    setBatchToDelete(null)
    setDeleteError(null)
  }

  const getSelectedLabel = () => {
    if (!selectedBatchId) {
      return 'All stories'
    }
    const batch = batches.find(b => b.id === selectedBatchId)
    return batch ? formatBatchLabel(batch) : 'All stories'
  }

  const totalStories = batches.reduce((sum, b) => sum + (b.story_count || 0), 0)

  return (
    <>
      <div className="story-batch-filter" ref={dropdownRef}>
        <label className="story-batch-filter-label">Filter by Batch</label>
        <button
          type="button"
          className="story-batch-filter-trigger"
          onClick={() => setIsOpen(!isOpen)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span className="story-batch-filter-value">
            {loading ? 'Loading...' : getSelectedLabel()}
          </span>
          <svg 
            className={`story-batch-filter-arrow ${isOpen ? 'story-batch-filter-arrow--open' : ''}`}
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        {isOpen && !loading && (
          <div className="story-batch-filter-dropdown" role="listbox">
            {/* All Stories Option */}
            <button
              type="button"
              className={`story-batch-filter-option ${!selectedBatchId ? 'story-batch-filter-option--selected' : ''}`}
              onClick={() => handleSelectBatch(null)}
              role="option"
              aria-selected={!selectedBatchId}
            >
              <span className="story-batch-filter-option-content">
                <span className="story-batch-filter-option-label">All stories</span>
                {totalStories > 0 && (
                  <span className="story-batch-filter-option-count">
                    {totalStories} {totalStories === 1 ? 'story' : 'stories'} total
                  </span>
                )}
              </span>
              {!selectedBatchId && (
                <svg className="story-batch-filter-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>

            {batches.length > 0 && (
              <div className="story-batch-filter-divider" />
            )}

            {/* Batch Options */}
            {batches.map((batch) => (
              <div
                key={batch.id}
                className={`story-batch-filter-option ${selectedBatchId === batch.id ? 'story-batch-filter-option--selected' : ''}`}
                role="option"
                aria-selected={selectedBatchId === batch.id}
              >
                <button
                  type="button"
                  className="story-batch-filter-option-main"
                  onClick={() => handleSelectBatch(batch.id)}
                >
                  <span className="story-batch-filter-option-content">
                    <span className="story-batch-filter-option-label">
                      {formatDate(batch.created_at)}
                    </span>
                    <span className="story-batch-filter-option-meta">
                      <span className="story-batch-filter-option-count">
                        {batch.story_count} {batch.story_count === 1 ? 'story' : 'stories'}
                      </span>
                      <span className="story-batch-filter-option-format">
                        {batch.format === 'classic' ? 'Classic' : 'Job Story'}
                      </span>
                    </span>
                  </span>
                  {selectedBatchId === batch.id && (
                    <svg className="story-batch-filter-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
                <button
                  type="button"
                  className="story-batch-filter-delete-btn"
                  onClick={(e) => handleDeleteClick(e, batch)}
                  aria-label={`Delete batch from ${formatDate(batch.created_at)}`}
                  title="Delete batch"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            ))}

            {batches.length === 0 && (
              <div className="story-batch-filter-empty">
                No batches available
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && batchToDelete && (
        <Modal title="Delete Batch?" onClose={handleCancelDelete}>
          <div className="story-batch-delete-confirm">
            <div className="story-batch-delete-warning">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <p className="story-batch-delete-message">
              This will permanently delete <strong>{batchToDelete.story_count}</strong> {batchToDelete.story_count === 1 ? 'story' : 'stories'} from this batch.
            </p>
            <p className="story-batch-delete-details">
              Batch created: {formatDate(batchToDelete.created_at)}
              <br />
              Format: {batchToDelete.format === 'classic' ? 'Classic' : 'Job Story'}
            </p>
            <p className="story-batch-delete-note">
              This action cannot be undone.
            </p>
            
            {deleteError && (
              <div className="story-batch-delete-error">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {deleteError}
              </div>
            )}

            <div className="story-batch-delete-actions">
              <button
                type="button"
                className="story-batch-delete-cancel-btn"
                onClick={handleCancelDelete}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="story-batch-delete-confirm-btn"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <svg className="story-batch-delete-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                    </svg>
                    Deleting...
                  </>
                ) : (
                  <>
                    Delete {batchToDelete.story_count} {batchToDelete.story_count === 1 ? 'Story' : 'Stories'}
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

export default StoryBatchFilter
