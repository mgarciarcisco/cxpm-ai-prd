import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { post, get } from '../services/api';
import { CollapsibleSection } from '../components/common/CollapsibleSection';
import { ConflictCard } from '../components/conflicts/ConflictCard';
import { BulkActions } from '../components/conflicts/BulkActions';
import LoadingSpinner from '../components/common/LoadingSpinner';
import './ConflictResolverPage.css';

function ConflictResolverPage() {
  const { id, mid } = useParams();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState(null);
  const [applyResults, setApplyResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [applyError, setApplyError] = useState(null);
  const [conflictResolutions, setConflictResolutions] = useState({});
  const [mergedTexts, setMergedTexts] = useState({});
  const [applyLoading, setApplyLoading] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);

  useEffect(() => {
    fetchData();
  }, [mid]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch meeting details first
      const meetingData = await get(`/api/meetings/${mid}`);
      setMeeting(meetingData);

      // Call POST /api/meetings/{id}/apply to get conflict detection results
      const results = await post(`/api/meetings/${mid}/apply`, {});
      setApplyResults(results);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="main-content">
        <div className="conflict-resolver-loading">
          <LoadingSpinner size="large" />
          <p>Analyzing meeting items...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="main-content">
        <div className="conflict-resolver-error">
          <p>Error: {error}</p>
          <button onClick={fetchData} className="retry-btn">Retry</button>
        </div>
      </main>
    );
  }

  const addedCount = applyResults?.added?.length || 0;
  const skippedCount = applyResults?.skipped?.length || 0;
  const conflictsCount = applyResults?.conflicts?.length || 0;

  /**
   * Handle resolution change for a conflict
   */
  const handleResolutionChange = (itemId, resolution) => {
    setConflictResolutions((prev) => ({
      ...prev,
      [itemId]: resolution,
    }));
  };

  /**
   * Get the AI recommended resolution for a conflict based on classification
   */
  const getAIRecommendation = (conflict) => {
    if (conflict.classification === 'refinement') {
      return 'conflict_replaced';
    } else if (conflict.classification === 'contradiction') {
      return 'conflict_keep_existing';
    }
    return null;
  };

  /**
   * Handle "Accept AI recommendations" bulk action
   * Sets all conflicts to their AI-recommended resolution
   */
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

  /**
   * Handle merged text save for a conflict
   */
  const handleMergedTextSave = (itemId, text) => {
    setMergedTexts((prev) => ({
      ...prev,
      [itemId]: text,
    }));
  };

  /**
   * Check if all conflicts have valid resolutions
   * For 'conflict_merged' decisions, merged text must also be provided
   */
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

  /**
   * Handle Apply Changes button click
   * Collects all decisions and calls POST /api/meetings/{id}/resolve
   */
  const handleApplyChanges = async () => {
    if (!allConflictsResolved()) return;

    setApplyLoading(true);
    setApplyError(null);

    try {
      // Build decisions array
      const decisions = [];

      // Add "added" items as 'added' decisions
      if (applyResults?.added) {
        applyResults.added.forEach((item) => {
          decisions.push({
            item_id: item.item_id,
            decision: 'added',
          });
        });
      }

      // Add "skipped" items as appropriate skipped decisions
      if (applyResults?.skipped) {
        applyResults.skipped.forEach((item) => {
          decisions.push({
            item_id: item.item_id,
            decision: item.reason?.includes('semantic') ? 'skipped_semantic' : 'skipped_duplicate',
          });
        });
      }

      // Add conflict resolutions
      if (applyResults?.conflicts) {
        applyResults.conflicts.forEach((conflict) => {
          const resolution = conflictResolutions[conflict.item_id];
          const decision = {
            item_id: conflict.item_id,
            decision: resolution,
            matched_requirement_id: conflict.matched_requirement?.id,
          };

          // Add merged text for merge decisions
          if (resolution === 'conflict_merged') {
            decision.merged_text = mergedTexts[conflict.item_id];
          }

          decisions.push(decision);
        });
      }

      // Call resolve endpoint
      await post(`/api/meetings/${mid}/resolve`, { decisions });

      // Show success state and navigate after delay
      setApplySuccess(true);
      setTimeout(() => {
        navigate(`/app/projects/${id}/requirements`);
      }, 1500);
    } catch (err) {
      setApplyError(err.message);
    } finally {
      setApplyLoading(false);
    }
  };

  /**
   * Handle retry after apply error
   */
  const handleRetryApply = () => {
    setApplyError(null);
    handleApplyChanges();
  };

  return (
    <main className="main-content">
      <section className="conflict-resolver-section">
        <div className="section-header">
          <div className="section-header-left">
            <h2>Apply Meeting: {meeting?.title || 'Meeting'}</h2>
            <Link to={`/app/projects/${id}/meetings/${mid}`} className="back-link">Back to Recap</Link>
          </div>
          <div className="section-header-right">
            <BulkActions
              conflicts={applyResults?.conflicts}
              onAcceptAllAI={handleAcceptAllAI}
            />
          </div>
        </div>

        {/* Summary Header */}
        <div className="conflict-resolver-summary">
          <div className="summary-item summary-added">
            <span className="summary-count">{addedCount}</span>
            <span className="summary-label">items will be added</span>
          </div>
          <div className="summary-item summary-skipped">
            <span className="summary-count">{skippedCount}</span>
            <span className="summary-label">duplicates skipped</span>
          </div>
          <div className="summary-item summary-conflicts">
            <span className="summary-count">{conflictsCount}</span>
            <span className="summary-label">conflicts need review</span>
          </div>
        </div>

        <div className="conflict-resolver-content">
          {/* Auto-added Section */}
          {addedCount > 0 && (
            <CollapsibleSection
              title="Items to be Added"
              itemCount={addedCount}
              defaultExpanded={true}
            >
              <div className="added-items-list">
                {applyResults.added.map((item) => (
                  <div key={item.item_id} className="added-item">
                    <div className="added-item-check">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M16.667 5L7.5 14.167L3.333 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <div className="added-item-content">
                      <span className="added-item-section">{formatSection(item.item_section)}</span>
                      <p className="added-item-text">{item.item_content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Skipped Duplicates Section */}
          {skippedCount > 0 && (
            <CollapsibleSection
              title="Skipped Duplicates"
              itemCount={skippedCount}
              defaultExpanded={false}
            >
              <div className="skipped-items-list">
                {applyResults.skipped.map((item) => (
                  <div key={item.item_id} className="skipped-item">
                    <div className="skipped-item-content">
                      <span className="skipped-item-section">{formatSection(item.item_section)}</span>
                      <p className="skipped-item-text">{item.item_content}</p>
                      <p className="skipped-item-reason">{item.reason}</p>
                      {item.matched_requirement && (
                        <div className="matched-requirement">
                          <span className="matched-label">Matches existing:</span>
                          <p className="matched-content">{item.matched_requirement.content}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Conflicts Section */}
          {conflictsCount > 0 && (
            <CollapsibleSection
              title="Conflicts Need Review"
              itemCount={conflictsCount}
              defaultExpanded={true}
            >
              <div className="conflicts-list">
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
            </CollapsibleSection>
          )}

          {/* No items message */}
          {addedCount === 0 && skippedCount === 0 && conflictsCount === 0 && (
            <div className="no-items-message">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <h3>No Items to Apply</h3>
              <p>No meeting items were found to apply to requirements.</p>
            </div>
          )}
        </div>

        {/* Apply Error Message */}
        {applyError && (
          <div className="apply-error-message">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
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
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
              <path d="M8 12l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Changes applied successfully! Redirecting to requirements...</span>
          </div>
        )}

        {/* Page Footer with Apply Changes button */}
        {(addedCount > 0 || skippedCount > 0 || conflictsCount > 0) && !applySuccess && (
          <div className="conflict-resolver-footer">
            <div className="footer-summary">
              {addedCount > 0 && <span>{addedCount} to add</span>}
              {skippedCount > 0 && <span>{skippedCount} skipped</span>}
              {conflictsCount > 0 && (
                <span className={allConflictsResolved() ? 'resolved' : 'unresolved'}>
                  {Object.keys(conflictResolutions).length}/{conflictsCount} conflicts resolved
                </span>
              )}
            </div>
            <button
              className="apply-changes-btn"
              onClick={handleApplyChanges}
              disabled={!allConflictsResolved() || applyLoading}
            >
              {applyLoading ? (
                <>
                  <span className="apply-spinner"></span>
                  Applying...
                </>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M16.667 5L7.5 14.167L3.333 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Apply Changes
                </>
              )}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

/**
 * Format section enum value to display text
 */
function formatSection(section) {
  const sectionLabels = {
    problems: 'Problems',
    user_goals: 'User Goals',
    functional_requirements: 'Functional Requirements',
    data_needs: 'Data Needs',
    constraints: 'Constraints',
    non_goals: 'Non-Goals',
    risks_assumptions: 'Risks & Assumptions',
    open_questions: 'Open Questions',
    action_items: 'Action Items',
  };
  return sectionLabels[section] || section;
}

export default ConflictResolverPage;
