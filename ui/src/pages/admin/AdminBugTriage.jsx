import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAdminBugReports, updateBugStatus, getBugReportStats } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import EmptyState from '../../components/common/EmptyState';
import './AdminBugTriage.css';

const SEVERITY_CLASSES = { blocker: 'badge--red', major: 'badge--yellow', minor: 'badge--gray' };
const STATUS_COLORS = {
  open: 'status-select--gray',
  investigating: 'status-select--blue',
  fixed: 'status-select--green',
  closed: 'status-select--gray',
};

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AdminBugTriage() {
  const { showSuccess, showError } = useToast();
  const [bugs, setBugs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [stats, setStats] = useState({ open: 0, investigating: 0, fixed: 0, closed: 0 });

  const loadBugs = async () => {
    setLoading(true);
    try {
      const data = await getAdminBugReports(page, 20, statusFilter, severityFilter);
      setBugs(data.items);
      setTotal(data.total);
    } catch (err) {
      console.error('Failed to load bugs:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load stats from dedicated endpoint on mount
  useEffect(() => {
    async function loadStats() {
      try {
        const data = await getBugReportStats();
        setStats({
          open: data.open || 0,
          investigating: data.investigating || 0,
          fixed: data.fixed || 0,
          closed: data.closed || 0,
        });
      } catch (err) {
        console.error('Failed to load stats:', err);
      }
    }
    loadStats();
  }, []);

  useEffect(() => { loadBugs(); }, [page, statusFilter, severityFilter]);

  const handleStatusChange = async (bugId, newStatus) => {
    try {
      const updated = await updateBugStatus(bugId, newStatus);
      setBugs(prev => prev.map(b => b.id === bugId ? updated : b));
      // Update stats
      setStats(prev => {
        const bug = bugs.find(b => b.id === bugId);
        if (!bug) return prev;
        return {
          ...prev,
          [bug.status]: Math.max(0, prev[bug.status] - 1),
          [newStatus]: prev[newStatus] + 1,
        };
      });
      showSuccess(`Status updated to ${newStatus}`);
    } catch (err) {
      showError(err.message || 'Failed to update status');
    }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="admin-bugs">
      <h1 className="admin-bugs__title">Bug Reports</h1>

      <div className="admin-bugs__stats">
        <div className="stat-card stat-card--highlight">
          <span className="stat-card__label">Open</span>
          <span className="stat-card__value">{stats.open}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__label">Investigating</span>
          <span className="stat-card__value">{stats.investigating}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__label">Fixed</span>
          <span className="stat-card__value">{stats.fixed}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__label">Closed</span>
          <span className="stat-card__value">{stats.closed}</span>
        </div>
      </div>

      <div className="admin-bugs__filters">
        <select className="filter-select" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="investigating">Investigating</option>
          <option value="fixed">Fixed</option>
          <option value="closed">Closed</option>
        </select>
        <select className="filter-select" value={severityFilter} onChange={(e) => { setSeverityFilter(e.target.value); setPage(1); }}>
          <option value="">All Severities</option>
          <option value="blocker">Blocker</option>
          <option value="major">Major</option>
          <option value="minor">Minor</option>
        </select>
      </div>

      {loading ? (
        <div className="admin-bugs__card">
          <div className="skeleton-table">
            {[1, 2, 3, 4].map(i => <div key={i} className="skeleton-row" />)}
          </div>
        </div>
      ) : bugs.length === 0 ? (
        <EmptyState title="No bug reports" description="No bug reports match the current filters." />
      ) : (
        <>
          <div className="admin-bugs__card">
            <table className="admin-bugs-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Reporter</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {bugs.map(bug => (
                  <tr key={bug.id}>
                    <td>
                      <Link to={`/bugs/${bug.id}`} className="admin-bugs-table__link">{bug.title}</Link>
                    </td>
                    <td className="admin-bugs-table__reporter">{bug.reporter_name || 'Unknown'}</td>
                    <td><span className={`badge ${SEVERITY_CLASSES[bug.severity] || ''}`}>{bug.severity}</span></td>
                    <td>
                      <select
                        className={`status-select ${STATUS_COLORS[bug.status] || ''}`}
                        value={bug.status}
                        onChange={(e) => handleStatusChange(bug.id, e.target.value)}
                      >
                        <option value="open">Open</option>
                        <option value="investigating">Investigating</option>
                        <option value="fixed">Fixed</option>
                        <option value="closed">Closed</option>
                      </select>
                    </td>
                    <td className="admin-bugs-table__date">{formatDate(bug.created_at)}</td>
                    <td>
                      <Link to={`/bugs/${bug.id}`} className="admin-bugs-table__view">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <span className="pagination__info">Showing {(page - 1) * 20 + 1}-{Math.min(page * 20, total)} of {total} bugs</span>
              <div className="pagination__buttons">
                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i + 1}
                    className={`pagination__btn ${page === i + 1 ? 'pagination__btn--active' : ''}`}
                    onClick={() => setPage(i + 1)}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
