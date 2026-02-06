import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './AdminDashboard.css';

const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:8000');

export default function AdminDashboard() {
  const { getToken } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/admin/stats`, {
        headers: { 'Authorization': `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Failed to fetch stats');
      setStats(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="admin-dashboard">
        <h1>Dashboard</h1>
        <div className="admin-stats-grid">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="admin-stat-card admin-stat-card--skeleton">
              <div className="skeleton-line skeleton-line--short" />
              <div className="skeleton-line skeleton-line--long" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-dashboard">
        <h1>Dashboard</h1>
        <div className="admin-error">Failed to load dashboard: {error}</div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <h1>Dashboard</h1>

      {/* User Metrics */}
      <h3 className="admin-section-title">Users</h3>
      <div className="admin-stats-grid">
        <Link to="/admin/users?status=pending" className="admin-stat-card admin-stat-card--highlight">
          <div className="admin-stat-card__label">Pending Approval</div>
          <div className="admin-stat-card__value">{stats.users.pending}</div>
        </Link>
        <div className="admin-stat-card">
          <div className="admin-stat-card__label">Total Users</div>
          <div className="admin-stat-card__value">{stats.users.total}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-card__label">Active Today</div>
          <div className="admin-stat-card__value">{stats.users.active_today}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-card__label">Active This Week</div>
          <div className="admin-stat-card__value">{stats.users.active_this_week}</div>
        </div>
      </div>

      {/* Content Metrics */}
      <h3 className="admin-section-title">Content</h3>
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-card__label">Total Projects</div>
          <div className="admin-stat-card__value">{stats.content.total_projects}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-card__label">PRDs Generated</div>
          <div className="admin-stat-card__value">{stats.content.total_prds}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-card__label">User Stories</div>
          <div className="admin-stat-card__value">{stats.content.total_stories}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-card__label">Meeting Recaps</div>
          <div className="admin-stat-card__value">{stats.content.total_meetings}</div>
        </div>
      </div>

      {/* Weekly Change */}
      <h3 className="admin-section-title">This Week</h3>
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-card__label">New Users</div>
          <div className="admin-stat-card__value admin-stat-card__value--change">+{stats.weekly_change.users}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-card__label">New Projects</div>
          <div className="admin-stat-card__value admin-stat-card__value--change">+{stats.weekly_change.projects}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-card__label">New PRDs</div>
          <div className="admin-stat-card__value admin-stat-card__value--change">+{stats.weekly_change.prds}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-card__label">New Stories</div>
          <div className="admin-stat-card__value admin-stat-card__value--change">+{stats.weekly_change.stories}</div>
        </div>
      </div>
    </div>
  );
}
