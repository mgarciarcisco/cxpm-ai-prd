import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { post, get } from '../services/api';
import { CollapsibleSection } from '../components/common/CollapsibleSection';
import { ConflictCard } from '../components/conflicts/ConflictCard';
import './ConflictResolverPage.css';

function ConflictResolverPage() {
  const { id, mid } = useParams();
  const [meeting, setMeeting] = useState(null);
  const [applyResults, setApplyResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [conflictResolutions, setConflictResolutions] = useState({});

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
          <div className="loading-spinner"></div>
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

  return (
    <main className="main-content">
      <section className="conflict-resolver-section">
        <div className="section-header">
          <h2>Apply Meeting: {meeting?.title || 'Meeting'}</h2>
          <Link to={`/app/projects/${id}/meetings/${mid}`} className="back-link">Back to Recap</Link>
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
