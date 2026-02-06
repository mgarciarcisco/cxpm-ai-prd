import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import './AdminUserManagement.css';

const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:8000');

const STATUS_TABS = [
  { key: null, label: 'All Users' },
  { key: 'pending', label: 'Pending' },
  { key: 'active', label: 'Active' },
  { key: 'deactivated', label: 'Deactivated' },
];

export default function AdminUserManagement() {
  const { getToken, user: currentUser } = useAuth();
  const { showSuccess, showError } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(searchParams.get('status') || null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [actionLoading, setActionLoading] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [tempPassword, setTempPassword] = useState(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, per_page: 25 });
      if (activeTab) params.set('status', activeTab);
      if (search) params.set('search', search);

      const res = await fetch(`${BASE_URL}/api/admin/users?${params}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      setUsers(data.users);
      setTotal(data.total);
    } catch (err) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  }, [getToken, activeTab, search, page, showError]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setPage(1);
    setSelectedIds(new Set());
    if (tab) {
      setSearchParams({ status: tab });
    } else {
      setSearchParams({});
    }
  };

  const doAction = async (endpoint, userId, successMsg) => {
    setActionLoading(userId || 'bulk');
    try {
      const res = await fetch(`${BASE_URL}/api/admin/users/${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Action failed');
      }
      const data = await res.json();
      showSuccess(data.message || successMsg);
      fetchUsers();
    } catch (err) {
      showError(err.message);
    } finally {
      setActionLoading(null);
      setConfirmDialog(null);
    }
  };

  const doBulkAction = async (action) => {
    setActionLoading('bulk');
    try {
      const res = await fetch(`${BASE_URL}/api/admin/users/bulk-${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_ids: [...selectedIds] }),
      });
      if (!res.ok) throw new Error('Bulk action failed');
      const data = await res.json();
      showSuccess(`${data.success_count} users ${action}d`);
      if (data.errors.length) {
        data.errors.forEach(e => showError(e));
      }
      setSelectedIds(new Set());
      fetchUsers();
    } catch (err) {
      showError(err.message);
    } finally {
      setActionLoading(null);
      setConfirmDialog(null);
    }
  };

  const handleResetPassword = async (userId) => {
    setActionLoading(userId);
    try {
      const res = await fetch(`${BASE_URL}/api/admin/users/${userId}/reset-password`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Reset failed');
      const data = await res.json();
      setTempPassword(data.temporary_password);
      showSuccess('Temporary password generated');
      fetchUsers();
    } catch (err) {
      showError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === users.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(users.map(u => u.id)));
    }
  };

  const getUserStatus = (user) => {
    if (!user.is_active && !user.is_approved) return 'rejected';
    if (!user.is_active) return 'deactivated';
    if (!user.is_approved) return 'pending';
    if (user.locked_until && new Date(user.locked_until) > new Date()) return 'locked';
    return 'active';
  };

  const getStatusBadge = (status) => {
    const classes = {
      active: 'admin-badge--success',
      pending: 'admin-badge--warning',
      deactivated: 'admin-badge--danger',
      rejected: 'admin-badge--danger',
      locked: 'admin-badge--danger',
    };
    return `admin-badge ${classes[status] || ''}`;
  };

  const totalPages = Math.ceil(total / 25);

  return (
    <div className="admin-users">
      <h1>User Management</h1>

      {/* Tabs */}
      <div className="admin-tabs">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.key || 'all'}
            className={`admin-tab${activeTab === tab.key ? ' active' : ''}`}
            onClick={() => handleTabChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="admin-toolbar">
        <input
          type="text"
          className="admin-search"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        {selectedIds.size > 0 && activeTab === 'pending' && (
          <div className="admin-bulk-actions">
            <button className="admin-btn admin-btn--success" onClick={() => doBulkAction('approve')} disabled={actionLoading === 'bulk'}>
              Approve ({selectedIds.size})
            </button>
            <button className="admin-btn admin-btn--danger" onClick={() => setConfirmDialog({ type: 'bulk-reject', count: selectedIds.size })} disabled={actionLoading === 'bulk'}>
              Reject ({selectedIds.size})
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="admin-table-skeleton">
          {[...Array(5)].map((_, i) => <div key={i} className="admin-table-skeleton__row" />)}
        </div>
      ) : users.length === 0 ? (
        <div className="admin-empty">
          <p>{search ? 'No users match your search' : activeTab === 'pending' ? 'No pending approvals' : 'No users found'}</p>
        </div>
      ) : (
        <>
          <table className="admin-table">
            <thead>
              <tr>
                <th><input type="checkbox" checked={selectedIds.size === users.length && users.length > 0} onChange={toggleSelectAll} /></th>
                <th>User</th>
                <th>Status</th>
                <th>Role</th>
                <th>Last Active</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => {
                const status = getUserStatus(user);
                const isSelf = user.id === currentUser?.id;
                return (
                  <tr key={user.id}>
                    <td><input type="checkbox" checked={selectedIds.has(user.id)} onChange={() => toggleSelect(user.id)} /></td>
                    <td>
                      <div className="admin-user-cell">
                        <div className="admin-user-avatar">{user.name.charAt(0).toUpperCase()}</div>
                        <div>
                          <div className="admin-user-name">{user.name}</div>
                          <div className="admin-user-email">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className={getStatusBadge(status)}>{status}</span></td>
                    <td><span className={user.is_admin ? 'admin-badge--info' : ''}>{user.is_admin ? 'Admin' : 'User'}</span></td>
                    <td className="admin-date">{user.last_active_at ? new Date(user.last_active_at).toLocaleDateString() : 'Never'}</td>
                    <td className="admin-date">{new Date(user.created_at).toLocaleDateString()}</td>
                    <td>
                      <div className="admin-actions">
                        {status === 'pending' && (
                          <>
                            <button className="admin-btn admin-btn--sm admin-btn--success" onClick={() => doAction(`${user.id}/approve`, user.id, 'Approved')} disabled={actionLoading === user.id}>Approve</button>
                            <button className="admin-btn admin-btn--sm admin-btn--danger" onClick={() => setConfirmDialog({ type: 'reject', user })} disabled={actionLoading === user.id}>Reject</button>
                          </>
                        )}
                        {status === 'active' && !isSelf && (
                          <>
                            {!user.is_admin && <button className="admin-btn admin-btn--sm" onClick={() => doAction(`${user.id}/make-admin`, user.id, 'Promoted')} disabled={actionLoading === user.id}>Make Admin</button>}
                            {user.is_admin && <button className="admin-btn admin-btn--sm" onClick={() => doAction(`${user.id}/remove-admin`, user.id, 'Demoted')} disabled={actionLoading === user.id}>Remove Admin</button>}
                            <button className="admin-btn admin-btn--sm" onClick={() => handleResetPassword(user.id)} disabled={actionLoading === user.id}>Reset PW</button>
                            <button className="admin-btn admin-btn--sm admin-btn--danger" onClick={() => setConfirmDialog({ type: 'deactivate', user })} disabled={actionLoading === user.id}>Deactivate</button>
                          </>
                        )}
                        {status === 'locked' && (
                          <>
                            <button className="admin-btn admin-btn--sm admin-btn--success" onClick={() => doAction(`${user.id}/unlock`, user.id, 'Unlocked')} disabled={actionLoading === user.id}>Unlock</button>
                            <button className="admin-btn admin-btn--sm" onClick={() => handleResetPassword(user.id)} disabled={actionLoading === user.id}>Reset PW</button>
                          </>
                        )}
                        {(status === 'deactivated' || status === 'rejected') && (
                          <button className="admin-btn admin-btn--sm admin-btn--success" onClick={() => doAction(`${user.id}/reactivate`, user.id, 'Reactivated')} disabled={actionLoading === user.id}>Reactivate</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="admin-pagination">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button>
              <span>Page {page} of {totalPages}</span>
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          )}
        </>
      )}

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div className="admin-dialog-overlay" onClick={() => setConfirmDialog(null)}>
          <div className="admin-dialog" onClick={e => e.stopPropagation()}>
            <h3>Confirm Action</h3>
            <p>
              {confirmDialog.type === 'reject' && `Reject ${confirmDialog.user.name}? They won't be able to access the platform.`}
              {confirmDialog.type === 'deactivate' && `Deactivate ${confirmDialog.user.name}? They will lose access immediately.`}
              {confirmDialog.type === 'bulk-reject' && `Reject ${confirmDialog.count} users? This cannot be undone.`}
            </p>
            <div className="admin-dialog__actions">
              <button className="admin-btn" onClick={() => setConfirmDialog(null)}>Cancel</button>
              <button className="admin-btn admin-btn--danger" onClick={() => {
                if (confirmDialog.type === 'reject') doAction(`${confirmDialog.user.id}/reject`, confirmDialog.user.id, 'Rejected');
                else if (confirmDialog.type === 'deactivate') doAction(`${confirmDialog.user.id}/deactivate`, confirmDialog.user.id, 'Deactivated');
                else if (confirmDialog.type === 'bulk-reject') doBulkAction('reject');
              }}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Temp Password Dialog */}
      {tempPassword && (
        <div className="admin-dialog-overlay" onClick={() => setTempPassword(null)}>
          <div className="admin-dialog" onClick={e => e.stopPropagation()}>
            <h3>Temporary Password</h3>
            <p>Copy this password and send it to the user:</p>
            <div className="admin-temp-password">
              <code>{tempPassword}</code>
              <button className="admin-btn admin-btn--sm" onClick={() => { navigator.clipboard.writeText(tempPassword); showSuccess('Copied to clipboard'); }}>Copy</button>
            </div>
            <div className="admin-dialog__actions">
              <button className="admin-btn" onClick={() => setTempPassword(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
