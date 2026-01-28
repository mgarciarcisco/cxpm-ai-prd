import React, { useState, useEffect, useRef, useCallback } from 'react';
import { listPRDs, getPRD, restorePRD } from '../../services/api';
import './VersionHistory.css';

/**
 * PRD Version History component - shows version indicator and dropdown for version history
 *
 * @param {object} props
 * @param {string} props.projectId - Project UUID to list PRDs for
 * @param {string} props.currentPrdId - Current PRD UUID (to highlight)
 * @param {number} props.currentVersion - Current PRD version number
 * @param {function} props.onVersionSelect - Callback when a version is selected for preview
 * @param {function} props.onVersionLoad - Callback when version data is loaded (receives PRD data)
 * @param {function} props.onRestore - Callback when a version is successfully restored (receives new PRD data)
 * @param {string} props.previewingVersionId - ID of version currently being previewed (for restore button)
 */
function VersionHistory({ projectId, currentPrdId, currentVersion, onVersionSelect, onVersionLoad, onRestore, previewingVersionId }) {
  const [isOpen, setIsOpen] = useState(false);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [previewingId, setPreviewingId] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const dropdownRef = useRef(null);

  // Fetch versions when dropdown opens
  const fetchVersions = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await listPRDs(projectId, { limit: 50 });
      // Sort by version descending (newest first)
      const sortedVersions = (data.items || data || []).sort((a, b) => b.version - a.version);
      setVersions(sortedVersions);
    } catch (err) {
      console.error('Failed to fetch PRD versions:', err);
      setError('Failed to load versions');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (isOpen && projectId) {
      fetchVersions();
    }
  }, [isOpen, projectId, fetchVersions]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close dropdown on Escape
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleVersionClick = async (prd) => {
    if (prd.id === currentPrdId) {
      setIsOpen(false);
      return;
    }

    setPreviewingId(prd.id);

    try {
      // Fetch full PRD data for preview
      const fullPrd = await getPRD(prd.id);

      // Notify parent about selected version
      if (onVersionSelect) {
        onVersionSelect(prd);
      }

      // Pass the full PRD data to parent for preview
      if (onVersionLoad) {
        onVersionLoad(fullPrd);
      }

      setIsOpen(false);
    } catch (err) {
      console.error('Failed to load version:', err);
      setError('Failed to load version');
    } finally {
      setPreviewingId(null);
    }
  };

  // Handle restore - creates a new version from the previewing version
  const handleRestore = async () => {
    if (!previewingVersionId) return;

    setRestoring(true);
    try {
      const newPrd = await restorePRD(previewingVersionId);
      // Notify parent of successful restore
      if (onRestore) {
        onRestore(newPrd);
      }
    } catch (err) {
      console.error('Failed to restore version:', err);
      setError('Failed to restore version');
    } finally {
      setRestoring(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatRelativeTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateString);
  };

  const formatMode = (mode) => {
    if (!mode) return '';
    return mode.charAt(0).toUpperCase() + mode.slice(1).toLowerCase();
  };

  // Don't render if no version number
  if (!currentVersion) {
    return null;
  }

  // Check if we're previewing a historical version (not the current one)
  const isPreviewingOldVersion = previewingVersionId && previewingVersionId !== currentPrdId;

  return (
    <div className="version-history" ref={dropdownRef}>
      <button
        type="button"
        className="version-history__trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <svg
          className="version-history__icon"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <span className="version-history__label">Version {currentVersion}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`version-history__chevron ${isOpen ? 'version-history__chevron--open' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Restore button - shown when previewing a historical version */}
      {isPreviewingOldVersion && (
        <button
          type="button"
          className="version-history__restore"
          onClick={handleRestore}
          disabled={restoring}
          title="Restore this version as a new version"
        >
          {restoring ? (
            <svg className="version-history__spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
            </svg>
          ) : (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          )}
          <span>{restoring ? 'Restoring...' : 'Restore'}</span>
        </button>
      )}

      {isOpen && (
        <div className="version-history__dropdown" role="listbox">
          <div className="version-history__header">
            <span className="version-history__title">Version History</span>
            <span className="version-history__count">{versions.length} version{versions.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="version-history__content">
            {loading && (
              <div className="version-history__loading">
                <svg className="version-history__spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                </svg>
                Loading versions...
              </div>
            )}

            {error && !loading && (
              <div className="version-history__error">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
                <button
                  type="button"
                  className="version-history__retry"
                  onClick={fetchVersions}
                >
                  Retry
                </button>
              </div>
            )}

            {!loading && !error && versions.length === 0 && (
              <div className="version-history__empty">
                No version history available
              </div>
            )}

            {!loading && !error && versions.length > 0 && (
              <ul className="version-history__list">
                {versions.map((prd) => (
                  <li key={prd.id}>
                    <button
                      type="button"
                      className={`version-history__item ${prd.id === currentPrdId ? 'version-history__item--current' : ''}`}
                      onClick={() => handleVersionClick(prd)}
                      role="option"
                      aria-selected={prd.id === currentPrdId}
                      disabled={previewingId === prd.id}
                    >
                      <div className="version-history__item-main">
                        <span className="version-history__item-version">
                          Version {prd.version}
                        </span>
                        {prd.id === currentPrdId && (
                          <span className="version-history__item-badge">Current</span>
                        )}
                        {prd.mode && (
                          <span className="version-history__item-mode">{formatMode(prd.mode)}</span>
                        )}
                      </div>
                      <div className="version-history__item-meta">
                        <span className="version-history__item-time">{formatRelativeTime(prd.created_at)}</span>
                        <span className="version-history__item-date">{formatDate(prd.created_at)}</span>
                      </div>
                      {previewingId === prd.id && (
                        <span className="version-history__item-loading">
                          <svg className="version-history__spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                          </svg>
                        </span>
                      )}
                      {prd.id === currentPrdId && !previewingId && (
                        <span className="version-history__item-check">
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
  );
}

export default VersionHistory;
