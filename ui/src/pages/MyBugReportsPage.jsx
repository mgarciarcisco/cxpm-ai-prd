import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getMyBugReports } from '../services/api';
import EmptyState from '../components/common/EmptyState';
import BugReportModal from '../components/common/BugReportModal';
import './MyBugReportsPage.css';

const SEVERITY_CLASSES = { blocker: 'badge--red', major: 'badge--yellow', minor: 'badge--gray' };
const STATUS_CLASSES = { open: 'badge--gray', investigating: 'badge--blue', fixed: 'badge--green', closed: 'badge--gray' };

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function MyBugReportsPage() {
  const [bugs, setBugs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const loadBugs = async () => {
    setLoading(true);
    try {
      const data = await getMyBugReports(page);
      setBugs(data.items);
      setTotal(data.total);
    } catch (err) {
      console.error('Failed to load bugs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadBugs(); }, [page]);

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="my-bugs-page">
      <div className="my-bugs-page__breadcrumbs">
        <Link to="/dashboard">Dashboard</Link>
        <span className="breadcrumb-sep">/</span>
        <span>My Bug Reports</span>
      </div>

      <div className="my-bugs-page__header">
        <div>
          <h1 className="my-bugs-page__title">My Bug Reports</h1>
          <p className="my-bugs-page__subtitle">Track the status of bugs you've reported</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          Report New Bug
        </button>
      </div>

      {loading ? (
        <div className="my-bugs-page__card">
          <div className="skeleton-table">
            {[1, 2, 3].map(i => <div key={i} className="skeleton-row" />)}
          </div>
        </div>
      ) : bugs.length === 0 ? (
        <EmptyState
          title="No bug reports yet"
          description="You haven't reported any bugs. Use the button above to report your first one."
        />
      ) : (
        <>
          <div className="my-bugs-page__card">
            <table className="bugs-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {bugs.map(bug => (
                  <tr key={bug.id}>
                    <td>
                      <Link to={`/bugs/${bug.id}`} className="bugs-table__link">
                        {bug.title}
                      </Link>
                    </td>
                    <td><span className={`badge ${SEVERITY_CLASSES[bug.severity] || ''}`}>{bug.severity}</span></td>
                    <td><span className={`badge ${STATUS_CLASSES[bug.status] || ''}`}>{bug.status}</span></td>
                    <td className="bugs-table__date">{formatDate(bug.created_at)}</td>
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

      {showModal && <BugReportModal onClose={() => { setShowModal(false); loadBugs(); }} />}
    </div>
  );
}
