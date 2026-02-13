import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getBugReport, updateBugStatus, fetchBugScreenshot } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import './BugReportDetailPage.css';

const SEVERITY_CLASSES = { blocker: 'badge--red', major: 'badge--yellow', minor: 'badge--gray' };
const STATUS_CLASSES = { open: 'badge--gray', investigating: 'badge--blue', fixed: 'badge--green', closed: 'badge--gray' };

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function BugReportDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const [bug, setBug] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [screenshotUrl, setScreenshotUrl] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await getBugReport(id);
        setBug(data);
      } catch (err) {
        if (err.message?.includes('404') || err.message?.includes('not found')) {
          setError('This bug report was not found or has been removed.');
        } else {
          setError(err.message || 'Failed to load bug report');
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  useEffect(() => {
    if (bug?.has_screenshot) {
      fetchBugScreenshot(bug.id)
        .then(url => setScreenshotUrl(url))
        .catch(err => console.error('Failed to load screenshot:', err));
    }
    return () => {
      if (screenshotUrl) URL.revokeObjectURL(screenshotUrl);
    };
  }, [bug?.id, bug?.has_screenshot]);

  const handleStatusChange = async (newStatus) => {
    try {
      const updated = await updateBugStatus(id, newStatus);
      setBug(updated);
      showSuccess(`Status updated to ${newStatus}`);
    } catch (err) {
      showError(err.message || 'Failed to update status');
    }
  };

  if (loading) return <div className="bug-detail-page"><div className="bug-detail-page__loading">Loading...</div></div>;
  if (error) return (
    <div className="bug-detail-page">
      <div className="bug-detail-page__error">
        <p>{error}</p>
        <Link to="/my-bugs" className="btn btn-secondary">Back to My Bugs</Link>
      </div>
    </div>
  );
  if (!bug) return null;

  const isAdmin = user?.is_admin;

  return (
    <div className="bug-detail-page">
      <div className="bug-detail-page__breadcrumbs">
        <Link to="/dashboard">Dashboard</Link>
        <span className="breadcrumb-sep">/</span>
        <Link to="/my-bugs">My Bug Reports</Link>
        <span className="breadcrumb-sep">/</span>
        <span>BUG-{bug.id.substring(0, 8)}</span>
      </div>

      <div className="bug-detail-page__title-row">
        <h1 className="bug-detail-page__title">{bug.title}</h1>
        <span className={`badge ${STATUS_CLASSES[bug.status] || ''}`}>{bug.status}</span>
      </div>

      <div className="bug-detail-page__grid">
        <div className="bug-detail-page__content">
          <div className="detail-card">
            <h3 className="detail-card__label">Description</h3>
            <p className="detail-card__value">{bug.description}</p>
          </div>

          {bug.steps_to_reproduce && (
            <div className="detail-card">
              <h3 className="detail-card__label">Steps to Reproduce</h3>
              <div className="detail-card__value">
                {bug.steps_to_reproduce.split('\n').map((step, i) => (
                  <p key={i}>{step}</p>
                ))}
              </div>
            </div>
          )}

          {bug.has_screenshot && screenshotUrl && (
            <div className="detail-card">
              <h3 className="detail-card__label">Screenshot</h3>
              <div className="detail-card__screenshot">
                <img src={screenshotUrl} alt="Bug screenshot" />
              </div>
            </div>
          )}
        </div>

        <div className="bug-detail-page__sidebar">
          <div className="detail-card">
            {isAdmin ? (
              <div className="sidebar-field">
                <span className="sidebar-field__label">Status</span>
                <select
                  className="form-select sidebar-status-select"
                  value={bug.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                >
                  <option value="open">Open</option>
                  <option value="investigating">Investigating</option>
                  <option value="fixed">Fixed</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            ) : (
              <div className="sidebar-field">
                <span className="sidebar-field__label">Status</span>
                <span className={`badge ${STATUS_CLASSES[bug.status] || ''}`}>{bug.status}</span>
              </div>
            )}
            <div className="sidebar-divider" />
            <div className="sidebar-field">
              <span className="sidebar-field__label">Severity</span>
              <span className={`badge ${SEVERITY_CLASSES[bug.severity] || ''}`}>{bug.severity}</span>
            </div>
            <div className="sidebar-divider" />
            <div className="sidebar-field">
              <span className="sidebar-field__label">Submitted</span>
              <span className="sidebar-field__value">{formatDate(bug.created_at)}</span>
            </div>
            {bug.page_url && (
              <>
                <div className="sidebar-divider" />
                <div className="sidebar-field">
                  <span className="sidebar-field__label">Page URL</span>
                  <span className="sidebar-field__value sidebar-field__value--mono">{bug.page_url}</span>
                </div>
              </>
            )}
            {bug.browser_info && (
              <>
                <div className="sidebar-divider" />
                <div className="sidebar-field">
                  <span className="sidebar-field__label">Browser</span>
                  <span className="sidebar-field__value sidebar-field__value--mono">{bug.browser_info}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
