import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import './AdminActivityLog.css';

const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:8000');

const ACTION_FILTERS = [
  { key: null, label: 'All' },
  { key: 'user.', label: 'Auth' },
  { key: 'project.', label: 'Projects' },
  { key: 'meeting.', label: 'Meetings' },
  { key: 'prd.', label: 'PRDs' },
  { key: 'story.', label: 'Stories' },
  { key: 'requirement.', label: 'Requirements' },
  { key: 'export.', label: 'Exports' },
  { key: 'admin.', label: 'Admin' },
];

const ACTION_COLORS = {
  'user.login': '#059669',
  'user.login_failed': '#DC2626',
  'user.login_locked': '#DC2626',
  'user.register': '#2563EB',
  'user.password_changed': '#D97706',
  'project.created': '#059669',
  'project.updated': '#2563EB',
  'project.deleted': '#DC2626',
  'meeting.uploaded': '#059669',
  'meeting.deleted': '#DC2626',
  'prd.generation_started': '#7C3AED',
  'prd.edited': '#2563EB',
  'story.created': '#059669',
  'story.updated': '#2563EB',
  'story.deleted': '#DC2626',
  'requirement.created': '#059669',
  'requirement.updated': '#2563EB',
  'requirement.deleted': '#DC2626',
  'admin.user_approved': '#059669',
  'admin.user_rejected': '#DC2626',
  'admin.user_deactivated': '#DC2626',
  'admin.user_reactivated': '#059669',
  'admin.user_promoted': '#7C3AED',
  'admin.user_demoted': '#D97706',
  'admin.password_reset': '#D97706',
};

function getActionColor(action) {
  if (ACTION_COLORS[action]) return ACTION_COLORS[action];
  if (action.includes('created') || action.includes('approved') || action.includes('login')) return '#059669';
  if (action.includes('deleted') || action.includes('rejected') || action.includes('failed')) return '#DC2626';
  if (action.includes('updated') || action.includes('edited')) return '#2563EB';
  return '#6B7280';
}

export default function AdminActivityLog() {
  const { getToken } = useAuth();
  const { showError } = useToast();

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState(null);
  const [page, setPage] = useState(1);

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, per_page: 25 });
      if (actionFilter) params.set('action', actionFilter);

      const res = await fetch(`${BASE_URL}/api/admin/activity?${params}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Failed to fetch activity');
      const data = await res.json();
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  }, [getToken, actionFilter, page, showError]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (actionFilter) params.set('action', actionFilter);

      const res = await fetch(`${BASE_URL}/api/admin/activity/export?${params}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'activity_log.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      showError(err.message);
    }
  };

  const totalPages = Math.ceil(total / 25);

  return (
    <div className="admin-activity">
      <div className="admin-activity__header">
        <h1>Activity Log</h1>
        <button className="admin-btn" onClick={handleExport}>Export CSV</button>
      </div>

      {/* Filter pills */}
      <div className="admin-filter-pills">
        {ACTION_FILTERS.map(f => (
          <button
            key={f.key || 'all'}
            className={`admin-pill${actionFilter === f.key ? ' active' : ''}`}
            onClick={() => { setActionFilter(f.key); setPage(1); }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="admin-table-skeleton">
          {[...Array(8)].map((_, i) => <div key={i} className="admin-table-skeleton__row" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="admin-empty">
          <p>No activity found</p>
          {actionFilter && <button className="admin-link" onClick={() => setActionFilter(null)}>Clear filters</button>}
        </div>
      ) : (
        <>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td className="admin-date">{new Date(item.created_at).toLocaleString()}</td>
                  <td>
                    {item.user_name ? (
                      <div>
                        <div className="admin-user-name">{item.user_name}</div>
                        <div className="admin-user-email">{item.user_email}</div>
                      </div>
                    ) : (
                      <span className="admin-text-muted">System</span>
                    )}
                  </td>
                  <td>
                    <span className="admin-action-badge" style={{ color: getActionColor(item.action), background: `${getActionColor(item.action)}14` }}>
                      {item.action}
                    </span>
                  </td>
                  <td className="admin-details">
                    {item.resource_type && <span className="admin-detail-tag">{item.resource_type}</span>}
                    {item.metadata && Object.entries(item.metadata).map(([k, v]) => (
                      <span key={k} className="admin-detail-meta">{k}: {String(v)}</span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="admin-pagination">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button>
              <span>Page {page} of {totalPages}</span>
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
