import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../contexts/NotificationContext';
import { getNotifications } from '../../services/api';
import './NotificationDropdown.css';

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

export default function NotificationDropdown({ onClose }) {
  const navigate = useNavigate();
  const { markAsRead, markAllAsRead, refreshNotifications } = useNotifications();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getNotifications(1, 10);
        setNotifications(data.items);
      } catch (err) {
        console.error('Failed to load notifications:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleClick = async (notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
      setNotifications(prev =>
        prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
      );
    }
    onClose();
    if (notification.resource_type === 'bug_report') {
      navigate(`/bugs/${notification.resource_id}`);
    } else if (notification.resource_type === 'feature_request') {
      navigate(`/feature-requests/${notification.resource_id}`);
    }
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  return (
    <div className="notification-dropdown">
      <div className="notification-dropdown__header">
        <span className="notification-dropdown__title">Notifications</span>
        <button
          className="notification-dropdown__mark-all"
          onClick={handleMarkAllRead}
        >
          Mark all as read
        </button>
      </div>

      <div className="notification-dropdown__body">
        {loading ? (
          <div className="notification-dropdown__loading">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="notification-dropdown__empty">No notifications yet.</div>
        ) : (
          notifications.map(notification => {
            const config = TYPE_CONFIG[notification.type] || TYPE_CONFIG.feature_comment;
            return (
              <button
                key={notification.id}
                className={`notification-item ${!notification.is_read ? 'notification-item--unread' : ''}`}
                onClick={() => handleClick(notification)}
              >
                <div className={`notification-item__icon ${config.bgClass}`}>
                  {config.emoji}
                </div>
                <div className="notification-item__content">
                  <div className="notification-item__title">{notification.title}</div>
                  {notification.message && (
                    <div className="notification-item__message">{notification.message}</div>
                  )}
                  <div className="notification-item__time">{formatTimeAgo(notification.created_at)}</div>
                </div>
                {!notification.is_read && <div className="notification-item__dot" />}
              </button>
            );
          })
        )}
      </div>

      <div className="notification-dropdown__footer">
        <button
          className="notification-dropdown__view-all"
          onClick={() => { onClose(); navigate('/notifications'); }}
        >
          View All Notifications
        </button>
      </div>
    </div>
  );
}
