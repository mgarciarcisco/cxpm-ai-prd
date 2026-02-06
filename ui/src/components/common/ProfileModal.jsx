import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import './ProfileModal.css';

const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:8000');

export default function ProfileModal({ onClose }) {
  const { user, getToken } = useAuth();
  const { showSuccess, showError } = useToast();

  const [activeTab, setActiveTab] = useState('profile');
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${BASE_URL}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to update profile');
      }
      showSuccess('Profile updated');
      // Reload user info - simplest approach is to refresh the page
      window.location.reload();
    } catch (err) {
      showError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showError('Passwords do not match');
      return;
    }
    setChangingPassword(true);
    try {
      const res = await fetch(`${BASE_URL}/api/auth/password`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to change password');
      }
      showSuccess('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      showError(err.message);
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="profile-overlay" onClick={onClose}>
      <div className="profile-modal" onClick={e => e.stopPropagation()}>
        <div className="profile-header">
          <h2>Account Settings</h2>
          <button className="profile-close" onClick={onClose}>&times;</button>
        </div>

        <div className="profile-tabs">
          <button className={`profile-tab${activeTab === 'profile' ? ' active' : ''}`} onClick={() => setActiveTab('profile')}>Profile</button>
          <button className={`profile-tab${activeTab === 'password' ? ' active' : ''}`} onClick={() => setActiveTab('password')}>Password</button>
        </div>

        {activeTab === 'profile' && (
          <form onSubmit={handleUpdateProfile} className="profile-form">
            <div className="profile-field">
              <label>Email</label>
              <input type="email" value={user?.email || ''} disabled />
              <span className="profile-hint">Email cannot be changed</span>
            </div>
            <div className="profile-field">
              <label>Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required minLength={1} />
            </div>
            <button type="submit" className="profile-btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        )}

        {activeTab === 'password' && (
          <form onSubmit={handleChangePassword} className="profile-form">
            <div className="profile-field">
              <label>Current Password</label>
              <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required />
            </div>
            <div className="profile-field">
              <label>New Password</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={8} />
              <span className="profile-hint">Min 8 chars, 1 uppercase, 1 lowercase, 1 number</span>
            </div>
            <div className="profile-field">
              <label>Confirm New Password</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
            </div>
            <button type="submit" className="profile-btn-primary" disabled={changingPassword}>
              {changingPassword ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
