import { useState, useEffect, useRef, useCallback } from 'react';
import { Modal } from '../common/Modal';
import {
  getProjectMembers,
  addProjectMember,
  updateMemberRole,
  removeProjectMember,
  searchUsers,
} from '../../services/api';
import './ProjectSharingModal.css';

const AVATAR_COLORS = ['teal', 'blue', 'purple', 'orange'];

function getAvatarColor(index) {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

function getInitials(name) {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ProjectSharingModal({ project, onClose }) {
  const [members, setMembers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedRole, setSelectedRole] = useState('viewer');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(null);
  const searchTimeoutRef = useRef(null);
  const dropdownRef = useRef(null);

  // Fetch members on mount
  useEffect(() => {
    fetchMembers();
  }, [project.id]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const data = await getProjectMembers(project.id);
      setMembers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (query.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchUsers(query);
        // Filter out users who are already members
        const memberIds = new Set(members.map((m) => m.user_id));
        const filtered = results.filter((u) => !memberIds.has(u.id));
        setSearchResults(filtered);
        setShowDropdown(filtered.length > 0);
      } catch {
        setSearchResults([]);
      }
    }, 300);
  }, [members]);

  const handleAddMember = async (user) => {
    try {
      setAdding(true);
      setError(null);
      await addProjectMember(project.id, {
        user_id: user.id,
        role: selectedRole,
      });
      setSearchQuery('');
      setSearchResults([]);
      setShowDropdown(false);
      await fetchMembers();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      setError(null);
      await updateMemberRole(project.id, userId, { role: newRole });
      setMembers((prev) =>
        prev.map((m) => (m.user_id === userId ? { ...m, role: newRole } : m))
      );
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRemove = async (userId) => {
    try {
      setError(null);
      await removeProjectMember(project.id, userId);
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Modal onClose={onClose} title={`Share "${project.name}"`}>
      <div className="sharing-modal">
        {error && (
          <div className="sharing-modal__error">
            {error}
            <button onClick={() => setError(null)} className="sharing-modal__error-dismiss">&times;</button>
          </div>
        )}

        {/* Search + Add Row */}
        <div className="share-input-row">
          <div className="share-search-wrapper" ref={dropdownRef}>
            <input
              type="text"
              className="share-search"
              placeholder="Search users by name or email..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              disabled={adding}
            />
            {showDropdown && (
              <ul className="share-search-dropdown">
                {searchResults.map((user) => (
                  <li
                    key={user.id}
                    className="share-search-result"
                    onClick={() => handleAddMember(user)}
                  >
                    <div className="share-search-result__avatar">
                      {getInitials(user.name)}
                    </div>
                    <div className="share-search-result__info">
                      <span className="share-search-result__name">{user.name}</span>
                      <span className="share-search-result__email">{user.email}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <select
            className="share-role-select"
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            disabled={adding}
          >
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
          </select>
        </div>

        {/* Member List */}
        <div className="members-label">
          Members ({members.length})
        </div>

        {loading ? (
          <div className="sharing-modal__loading">Loading members...</div>
        ) : (
          <ul className="member-list">
            {members.map((member, index) => (
              <li key={member.user_id} className="member-item">
                <div className={`member-avatar member-avatar--${getAvatarColor(index)}`}>
                  {getInitials(member.name)}
                </div>
                <div className="member-info">
                  <div className="member-name">{member.name}</div>
                  <div className="member-email">{member.email}</div>
                </div>
                {member.role === 'owner' ? (
                  <span className="role-badge role-badge--owner">Owner</span>
                ) : (
                  <>
                    <select
                      className="member-role-select"
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.user_id, e.target.value)}
                    >
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <button
                      className="member-remove"
                      onClick={() => handleRemove(member.user_id)}
                      title="Remove member"
                    >
                      &times;
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

export default ProjectSharingModal;
