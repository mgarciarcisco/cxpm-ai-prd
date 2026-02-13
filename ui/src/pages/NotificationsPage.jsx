import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useNotifications } from '../contexts/NotificationContext';
import { getNotifications } from '../services/api';
import EmptyState from '../components/common/EmptyState';
import './NotificationsPage.css';

const TYPE_CONFIG = {
  bug_status_change: { emoji: '\uD83D\uDC1B', bgClass: 'type-icon--bug' },
  feature_status_change: { emoji: '\uD83D\uDCA1', bgClass: 'type-icon--feature' },
  feature_comment: { emoji: '\uD83D\uDCAC', bgClass: 'type-icon--comment' },
};

function formatTimeAgo(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { markAsRead, markAllAsRead, refreshNotifications } = useNotifications();
  const [notifications, setNotifications] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'unread'

  const perPage = 20;

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getNotifications(page, perPage, filter === 'unread');
      setNotifications(data.items);
      setTotal(data.total);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleClick = async (notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
      setNotifications(prev =>
        prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
      );
    }
    if (notification.resource_type === 'bug_report') {
      navigate(`/bugs/${notification.resource_id}`);
    } else if (notification.resource_type === 'feature_request') {
      navigate(`/feature-requests/${notification.resource_id}`);
    }
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    refreshNotifications();
  };

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    setPage(1);
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="notifications-page">
      <div className="notifications-page__breadcrumbs">
        <Link to="/dashboard">Dashboard</Link>
        <span className="breadcrumb-sep">/</span>
        <span>Notifications</span>
      </div>

      <div className="notifications-page__header">
        <h1 className="notifications-page__title">Notifications</h1>
        <button
          className="notifications-page__mark-all"
          onClick={handleMarkAllRead}
        >
          Mark all as read
        </button>
      </div>

      <div className="notifications-page__filters">
        <button
          className={`notifications-page__filter-pill ${filter === 'all' ? 'notifications-page__filter-pill--active' : ''}`}
          onClick={() => handleFilterChange('all')}
        >
          All
        </button>
        <button
          className={`notifications-page__filter-pill ${filter === 'unread' ? 'notifications-page__filter-pill--active' : ''}`}
          onClick={() => handleFilterChange('unread')}
        >
          Unread
        </button>
      </div>

      {loading ? (
        <div className="notifications-page__card">
          <div className="skeleton-table">
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton-row" />)}
          </div>
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          emoji={filter === 'unread' ? '\u2705' : '\uD83D\uDD14'}
          title={filter === 'unread' ? 'All caught up!' : 'No notifications yet'}
          description={
            filter === 'unread'
              ? 'You have no unread notifications.'
              : 'Notifications will appear here when there are updates to your bug reports and feature requests.'
          }
        />
      ) : (
        <>
          <div className="notifications-page__card">
            <div className="notifications-page__list">
              {notifications.map(notification => {
                const config = TYPE_CONFIG[notification.type] || TYPE_CONFIG.feature_comment;
                return (
                  <button
                    key={notification.id}
                    className={`notifications-page__row ${!notification.is_read ? 'notifications-page__row--unread' : ''}`}
                    onClick={() => handleClick(notification)}
                  >
                    <div className={`notifications-page__type-icon ${config.bgClass}`}>
                      {config.emoji}
                    </div>
                    <div className="notifications-page__row-content">
                      <span className={`notifications-page__row-title ${!notification.is_read ? 'notifications-page__row-title--unread' : ''}`}>
                        {notification.title}
                      </span>
                      {notification.message && (
                        <span className="notifications-page__row-message">{notification.message}</span>
                      )}
                    </div>
                    <span className="notifications-page__row-time">{formatTimeAgo(notification.created_at)}</span>
                    {!notification.is_read && <div className="notifications-page__unread-dot" />}
                  </button>
                );
              })}
            </div>
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <span className="pagination__info">
                Showing {(page - 1) * perPage + 1}-{Math.min(page * perPage, total)} of {total} notifications
              </span>
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
