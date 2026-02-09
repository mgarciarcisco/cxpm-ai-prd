import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { post, get } from '../services/api';
import { ConflictCard } from '../components/conflicts/ConflictCard';
import { BulkActions } from '../components/conflicts/BulkActions';
import { Breadcrumbs } from '../components/common/Breadcrumbs';
import LoadingSpinner from '../components/common/LoadingSpinner';
import './ConflictResolverPage.css';

/**
 * Category configuration for side navigation
 */
const CATEGORIES = [
  { key: 'added', label: 'New Items', colorClass: 'added', icon: 'plus' },
  { key: 'skipped', label: 'Duplicates', colorClass: 'skipped', icon: 'duplicate' },
  { key: 'conflicts', label: 'Conflicts', colorClass: 'conflicts', icon: 'warning' },
];

/**
 * Side Navigation component for category selection
 */
function SideNav({ categories, categoryCounts, activeCategory, onCategoryChange, allConflictsResolved }) {
  return (
    <aside className="apply-side-nav">
      <div className="apply-side-nav__title">Categories</div>
      <ul className="apply-side-nav__list">
        {categories.map((category) => {
          const count = categoryCounts[category.key] || 0;
          const isActive = activeCategory === category.key;
          const isEmpty = count === 0;
          const needsAttention = category.key === 'conflicts' && count > 0 && !allConflictsResolved;
          return (
            <li key={category.key} className="apply-side-nav__item">
              <button
                type="button"
                onClick={() => onCategoryChange(category.key)}
                className={`apply-side-nav__link ${isActive ? 'apply-side-nav__link--active' : ''} ${needsAttention ? 'apply-side-nav__link--attention' : ''}`}
              >
                <span>{category.label}</span>
                <span className={`apply-side-nav__count apply-side-nav__count--${isEmpty ? 'empty' : category.colorClass}`}>
                  {count}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

function ConflictResolverPage() {
  const { id: projectId, mid } = useParams();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState(null);
  const [applyResults, setApplyResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingTooLong, setLoadingTooLong] = useState(false);
  const [error, setError] = useState(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [applyError, setApplyError] = useState(null);
  const [conflictResolutions, setConflictResolutions] = useState({});
  const [mergedTexts, setMergedTexts] = useState({});
  const [applyLoading, setApplyLoading] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);
  const [showNoConflictsModal, setShowNoConflictsModal] = useState(false);
  const [activeCategory, setActiveCategory] = useState('added');

  const isMountedRef = useRef(true);
  const abortControllerRef = useRef(null);
  const retryTimeoutRef = useRef(null);
  const retryCountRef = useRef(0);

  const effectiveProjectId = projectId || meeting?.project_id;

  // Category counts for side navigation
  const categoryCounts = useMemo(() => ({
    added: applyResults?.added?.length || 0,
    skipped: applyResults?.skipped?.length || 0,
    conflicts: applyResults?.conflicts?.length || 0,
  }), [applyResults]);

  // Auto-select first non-empty category when results load
  useEffect(() => {
    if (applyResults) {
      if (categoryCounts.conflicts > 0) {
        setActiveCategory('conflicts');
      } else if (categoryCounts.added > 0) {
        setActiveCategory('added');
      } else if (categoryCounts.skipped > 0) {
        setActiveCategory('skipped');
      }
    }
  }, [applyResults, categoryCounts]);

  const fetchData = useCallback(async (signal, isAutoRetry = false) => {
    console.log('[DEBUG Apply] fetchData called', { isAutoRetry, retryCount: retryCountRef.current });
    try {
      if (!isAutoRetry) {
        setLoading(true);
        setLoadingTooLong(false);
      }
      setError(null);

      const longLoadingTimer = setTimeout(() => {
        if (isMountedRef.current) {
          setLoadingTooLong(true);
        }
      }, 10000);

      try {
        console.log('[DEBUG Apply] Fetching meeting data...');
        const meetingData = await get(`/api/meetings/${mid}`, {
          signal,
          timeout: 30000
        });

        console.log('[DEBUG Apply] Meeting data received:', {
          id: meetingData.id,
          status: meetingData.status,
          project_id: meetingData.project_id,
          items_count: meetingData.items?.length
        });

        if (!isMountedRef.current) return;
        setMeeting(meetingData);

        // Check if meeting is ready to be applied
        if (meetingData.status !== 'processed' && meetingData.status !== 'applied') {
          console.log('[DEBUG Apply] Meeting not ready, status:', meetingData.status);
          // Meeting not ready - show waiting state or auto-retry
          if (retryCountRef.current < 5) {
            setIsRetrying(true);
            retryCountRef.current += 1;
            clearTimeout(longLoadingTimer);
            console.log('[DEBUG Apply] Scheduling retry #', retryCountRef.current);
            // Auto-retry after 2 seconds
            retryTimeoutRef.current = setTimeout(() => {
              if (isMountedRef.current && abortControllerRef.current) {
                fetchData(abortControllerRef.current.signal, true);
              }
            }, 2000);
            return;
          } else {
            throw new Error(`Meeting is still ${meetingData.status}. Please wait for processing to complete.`);
          }
        }

        setIsRetrying(false);
        retryCountRef.current = 0;

        console.log('[DEBUG Apply] Calling apply endpoint...');
        // Increased timeout to 3 minutes for large meetings with many items
        // Each item may require LLM classification against existing requirements
        const results = await post(`/api/meetings/${mid}/apply`, {}, {
          signal,
          timeout: 180000
        });

        console.log('[DEBUG Apply] Apply results received:', {
          added: results?.added?.length || 0,
          skipped: results?.skipped?.length || 0,
          conflicts: results?.conflicts?.length || 0,
          raw: results
        });

        if (!isMountedRef.current) return;

        clearTimeout(longLoadingTimer);
        setApplyResults(results);

        const hasConflicts = results?.conflicts?.length > 0;
        const hasItems = (results?.added?.length > 0) || (results?.skipped?.length > 0) || hasConflicts;

        if (hasItems && !hasConflicts) {
          setShowNoConflictsModal(true);
        }
      } finally {
        clearTimeout(longLoadingTimer);
      }
    } catch (err) {
      console.log('[DEBUG Apply] Error caught:', err.message);
      if (!isMountedRef.current) return;
      if (err.name === 'AbortError') {
        console.log('[DEBUG Apply] Request aborted');
        return;
      }

      // Check if it's a "not processed" error and auto-retry
      if (err.message?.includes('status is processed') && retryCountRef.current < 5) {
        console.log('[DEBUG Apply] Scheduling error-based retry #', retryCountRef.current + 1);
        setIsRetrying(true);
        retryCountRef.current += 1;
        retryTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current && abortControllerRef.current) {
            fetchData(abortControllerRef.current.signal, true);
          }
        }, 2000);
        return;
      }

      setError(err.message);
      setIsRetrying(false);
      setLoading(false);
    } finally {
      if (isMountedRef.current && !isAutoRetry) {
        setLoading(false);
        setLoadingTooLong(false);
      }
    }
  }, [mid]);

  useEffect(() => {
    isMountedRef.current = true;
    abortControllerRef.current = new AbortController();

    fetchData(abortControllerRef.current.signal);

    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [mid, fetchData]);

  const handleRetry = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
    retryCountRef.current = 0;
    setIsRetrying(false);
    abortControllerRef.current = new AbortController();
    fetchData(abortControllerRef.current.signal);
  }, [fetchData]);

  const handleCategoryChange = useCallback((categoryKey) => {
    setActiveCategory(categoryKey);
  }, []);

  // Build breadcrumb items
  const breadcrumbItems = useMemo(() => {
    if (effectiveProjectId) {
      return [
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Project', href: `/app/projects/${effectiveProjectId}` },
        { label: 'Extraction Results', href: `/app/projects/${effectiveProjectId}/meetings/${mid}` },
        { label: 'Apply Changes' }
      ];
    }
    return [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Apply Changes' }
    ];
  }, [effectiveProjectId, mid]);

  if (loading || isRetrying) {
    return (
      <div className="apply-page">
        <header className="apply-sticky-header">
          <div className="apply-sticky-header__inner">
            <div className="apply-sticky-header__left">
              <Breadcrumbs items={breadcrumbItems} />
              <h1 className="apply-sticky-header__title">Apply Meeting Changes</h1>
            </div>
          </div>
        </header>
        <main className="apply-loading-container">
          <div className="apply-loading">
            <LoadingSpinner size="large" />
            <p>{isRetrying ? 'Waiting for meeting to finish processing...' : 'Analyzing meeting items...'}</p>
            {isRetrying && (
              <p className="apply-loading__retry-hint">Attempt {retryCountRef.current} of 5</p>
            )}
            {loadingTooLong && !isRetrying && (
              <div className="loading-too-long">
                <p className="loading-too-long-text">Taking longer than expected...</p>
                <p className="loading-too-long-hint">The AI is analyzing your meeting items for conflicts. This can take up to a minute for large meetings.</p>
                <button onClick={handleRetry} className="retry-btn">
                  Cancel and Retry
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="apply-page">
        <header className="apply-sticky-header">
          <div className="apply-sticky-header__inner">
            <div className="apply-sticky-header__left">
              <Breadcrumbs items={breadcrumbItems} />
              <h1 className="apply-sticky-header__title">Apply Meeting Changes</h1>
            </div>
          </div>
        </header>
        <main className="apply-loading-container">
          <div className="apply-error">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <h3>Unable to Load</h3>
            <p>{error}</p>
            <button onClick={handleRetry} className="retry-btn">Try Again</button>
          </div>
        </main>
      </div>
    );
  }

  const addedCount = applyResults?.added?.length || 0;
  const skippedCount = applyResults?.skipped?.length || 0;
  const conflictsCount = applyResults?.conflicts?.length || 0;
  const totalCount = addedCount + skippedCount + conflictsCount;

  const handleResolutionChange = (itemId, resolution) => {
    setConflictResolutions((prev) => ({
      ...prev,
      [itemId]: resolution,
    }));
  };

  const getAIRecommendation = (conflict) => {
    if (conflict.classification === 'refinement') {
      return 'conflict_replaced';
    } else if (conflict.classification === 'contradiction') {
      return 'conflict_keep_existing';
    }
    return null;
  };

  const handleAcceptAllAI = () => {
    if (!applyResults?.conflicts) return;

    const newResolutions = {};
    applyResults.conflicts.forEach((conflict) => {
      const recommendation = getAIRecommendation(conflict);
      if (recommendation) {
        newResolutions[conflict.item_id] = recommendation;
      }
    });

    setConflictResolutions((prev) => ({
      ...prev,
      ...newResolutions,
    }));
  };

  const handleMergedTextSave = (itemId, text) => {
    setMergedTexts((prev) => ({
      ...prev,
      [itemId]: text,
    }));
  };

  const allConflictsResolved = () => {
    if (!applyResults?.conflicts || applyResults.conflicts.length === 0) {
      return true;
    }

    return applyResults.conflicts.every((conflict) => {
      const resolution = conflictResolutions[conflict.item_id];
      if (!resolution) return false;
      if (resolution === 'conflict_merged') {
        return mergedTexts[conflict.item_id]?.trim();
      }
      return true;
    });
  };

  const resolvedConflictsCount = applyResults?.conflicts?.filter(
    (c) => conflictResolutions[c.item_id] &&
    (conflictResolutions[c.item_id] !== 'conflict_merged' || mergedTexts[c.item_id]?.trim())
  ).length || 0;

  const handleApplyChanges = async () => {
    if (!allConflictsResolved()) return;

    setApplyLoading(true);
    setApplyError(null);

    try {
      const decisions = [];

      if (applyResults?.added) {
        applyResults.added.forEach((item) => {
          decisions.push({
            item_id: item.item_id,
            decision: 'added',
          });
        });
      }

      if (applyResults?.skipped) {
        applyResults.skipped.forEach((item) => {
          decisions.push({
            item_id: item.item_id,
            decision: item.reason?.includes('semantic') ? 'skipped_semantic' : 'skipped_duplicate',
          });
        });
      }

      if (applyResults?.conflicts) {
        applyResults.conflicts.forEach((conflict) => {
          const resolution = conflictResolutions[conflict.item_id];
          const decision = {
            item_id: conflict.item_id,
            decision: resolution,
            matched_requirement_id: conflict.matched_requirement?.id,
          };

          if (resolution === 'conflict_merged') {
            decision.merged_text = mergedTexts[conflict.item_id];
          }

          decisions.push(decision);
        });
      }

      await post(`/api/meetings/${mid}/resolve`, { decisions });

      setApplySuccess(true);
      setTimeout(() => {
        navigate(`/projects/${effectiveProjectId}/requirements`);
      }, 1500);
    } catch (err) {
      setApplyError(err.message);
    } finally {
      setApplyLoading(false);
    }
  };

  const handleRetryApply = () => {
    setApplyError(null);
    handleApplyChanges();
  };

  // Render active category content
  const renderCategoryContent = () => {
    switch (activeCategory) {
      case 'added':
        if (addedCount === 0) {
          return (
            <div className="apply-empty-category">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M8 12h8M12 8v8"/>
              </svg>
              <h3>No New Items</h3>
              <p>All items from this meeting either already exist or have conflicts.</p>
            </div>
          );
        }
        return (
          <div className="apply-items-list">
            {applyResults.added.map((item) => (
              <div key={item.item_id} className="apply-item apply-item--added">
                <div className="apply-item__icon apply-item__icon--added">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M16.667 5L7.5 14.167L3.333 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="apply-item__content">
                  <span className="apply-item__section apply-item__section--added">{formatSection(item.item_section)}</span>
                  <p className="apply-item__text">{item.item_content}</p>
                </div>
              </div>
            ))}
          </div>
        );

      case 'skipped':
        if (skippedCount === 0) {
          return (
            <div className="apply-empty-category">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M9 9h6v6H9z"/>
              </svg>
              <h3>No Duplicates</h3>
              <p>No items were identified as duplicates of existing requirements.</p>
            </div>
          );
        }
        return (
          <div className="apply-items-list">
            {applyResults.skipped.map((item) => (
              <div key={item.item_id} className="apply-item apply-item--skipped">
                <div className="apply-item__content">
                  <span className="apply-item__section apply-item__section--skipped">{formatSection(item.item_section)}</span>
                  <p className="apply-item__text">{item.item_content}</p>
                  <p className="apply-item__reason">{item.reason}</p>
                  {item.matched_requirement && (
                    <div className="apply-item__matched">
                      <span className="apply-item__matched-label">Matches existing:</span>
                      <p className="apply-item__matched-content">{item.matched_requirement.content}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        );

      case 'conflicts':
        if (conflictsCount === 0) {
          return (
            <div className="apply-empty-category apply-empty-category--success">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M8 12l3 3 5-6"/>
              </svg>
              <h3>No Conflicts</h3>
              <p>Great news! There are no conflicts between the new items and existing requirements.</p>
            </div>
          );
        }
        return (
          <div className="apply-conflicts-list">
            <div className="apply-conflicts-header">
              <p className="apply-conflicts-instruction">
                Review each conflict and choose how to resolve it.
                {conflictsCount > 0 && (
                  <span className="apply-conflicts-progress">
                    {resolvedConflictsCount}/{conflictsCount} resolved
                  </span>
                )}
              </p>
              <BulkActions
                conflicts={applyResults?.conflicts}
                onAcceptAllAI={handleAcceptAllAI}
              />
            </div>
            {applyResults.conflicts.map((conflict) => (
              <ConflictCard
                key={conflict.item_id}
                conflict={conflict}
                selectedResolution={conflictResolutions[conflict.item_id] || null}
                onResolutionChange={handleResolutionChange}
                mergedText={mergedTexts[conflict.item_id] || ''}
                onMergedTextSave={(text) => handleMergedTextSave(conflict.item_id, text)}
                formatSection={formatSection}
              />
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="apply-page">
      {/* Sticky Header */}
      <header className="apply-sticky-header">
        <div className="apply-sticky-header__inner">
          <div className="apply-sticky-header__left">
            <Breadcrumbs items={breadcrumbItems} />
            <div className="apply-sticky-header__title-group">
              <h1 className="apply-sticky-header__title">Apply: {meeting?.title || 'Meeting'}</h1>
            </div>
          </div>
          <div className="apply-sticky-header__summary">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12z"/>
              <path d="M8 5v3l2 1"/>
            </svg>
            {totalCount} items to review
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="apply-page-layout">
        {/* Side Navigation */}
        <SideNav
          categories={CATEGORIES}
          categoryCounts={categoryCounts}
          activeCategory={activeCategory}
          onCategoryChange={handleCategoryChange}
          allConflictsResolved={allConflictsResolved()}
        />

        {/* Main Content */}
        <main className="apply-main-content">
          <div className="apply-content-card">
            {renderCategoryContent()}
          </div>

          {/* Apply Error Message */}
          {applyError && (
            <div className="apply-error-message">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2"/>
                <line x1="10" y1="6" x2="10" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="10" cy="13" r="1" fill="currentColor"/>
              </svg>
              <span>Failed to apply changes: {applyError}</span>
              <button onClick={handleRetryApply} className="retry-link">
                Retry
              </button>
            </div>
          )}

          {/* Success Message */}
          {applySuccess && (
            <div className="apply-success-message">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                <path d="M8 12l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Changes applied successfully! Redirecting to requirements...</span>
            </div>
          )}
        </main>
      </div>

      {/* Sticky Footer */}
      {totalCount > 0 && !applySuccess && (
        <footer className="apply-sticky-footer">
          <div className="apply-sticky-footer__inner">
            <div className="apply-sticky-footer__summary">
              <span className="apply-footer-stat apply-footer-stat--added">
                <strong>{addedCount}</strong> to add
              </span>
              <span className="apply-footer-stat apply-footer-stat--skipped">
                <strong>{skippedCount}</strong> skipped
              </span>
              {conflictsCount > 0 && (
                <span className={`apply-footer-stat apply-footer-stat--conflicts ${allConflictsResolved() ? 'resolved' : ''}`}>
                  <strong>{resolvedConflictsCount}/{conflictsCount}</strong> conflicts resolved
                </span>
              )}
            </div>
            <div className="apply-sticky-footer__actions">
              <Link
                to={effectiveProjectId ? `/app/projects/${effectiveProjectId}/meetings/${mid}` : `/app/meetings/${mid}`}
                className="apply-btn apply-btn--secondary"
              >
                Cancel
              </Link>
              <button
                className="apply-btn apply-btn--primary"
                onClick={handleApplyChanges}
                disabled={!allConflictsResolved() || applyLoading}
              >
                {applyLoading ? (
                  <>
                    <span className="apply-btn__spinner"></span>
                    Applying...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M13.5 4.5L6 12L2.5 8.5"/>
                    </svg>
                    Apply Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </footer>
      )}

      {/* No Conflicts Modal */}
      {showNoConflictsModal && (
        <div className="no-conflicts-modal-overlay">
          <div className="no-conflicts-modal">
            <div className="no-conflicts-modal__icon">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="20" stroke="#22c55e" strokeWidth="3"/>
                <path d="M16 24l6 6 10-12" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3>No Conflicts Found</h3>
            <p>
              All {addedCount} items can be added to your project without any conflicts
              with existing requirements.
              {skippedCount > 0 && ` (${skippedCount} duplicates will be skipped)`}
            </p>
            <button
              className="no-conflicts-modal__btn"
              onClick={() => setShowNoConflictsModal(false)}
            >
              OK, Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Format section enum value to display text
 */
function formatSection(section) {
  const sectionLabels = {
    needs_and_goals: 'Needs & Goals',
    requirements: 'Requirements',
    scope_and_constraints: 'Scope & Constraints',
    risks_and_questions: 'Risks & Open Questions',
    action_items: 'Action Items',
  };
  return sectionLabels[section] || section;
}

export default ConflictResolverPage;
