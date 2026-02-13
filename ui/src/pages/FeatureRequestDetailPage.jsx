import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  getFeatureRequest,
  deleteFeatureRequest,
  updateFeatureStatus,
  getComments,
  addComment,
  updateComment,
  deleteComment,
} from '../services/api';
import UpvoteButton from '../components/feature-requests/UpvoteButton';
import './FeatureRequestDetailPage.css';

const CATEGORY_COLORS = {
  requirements: { bg: '#dbeafe', color: '#1d4ed8' },
  jira_integration: { bg: '#e0e7ff', color: '#4338ca' },
  export: { bg: '#fef3c7', color: '#b45309' },
  ui_ux: { bg: '#f3e8ff', color: '#7c3aed' },
  new_capability: { bg: '#dcfce7', color: '#15803d' },
};

const STATUS_CLASSES = {
  submitted: 'badge--gray',
  under_review: 'badge--blue',
  planned: 'badge--indigo',
  in_progress: 'badge--yellow',
  shipped: 'badge--green',
  declined: 'badge--red',
};

const CATEGORY_LABELS = {
  requirements: 'Requirements',
  jira_integration: 'Jira Integration',
  export: 'Export',
  ui_ux: 'UI/UX',
  new_capability: 'New Capability',
};

const STATUS_LABELS = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  planned: 'Planned',
  in_progress: 'In Progress',
  shipped: 'Shipped',
  declined: 'Declined',
};

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatCommentDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function FeatureRequestDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();

  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Comments state
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingContent, setEditingContent] = useState('');

  // Admin controls state
  const [adminStatus, setAdminStatus] = useState('');
  const [adminResponse, setAdminResponse] = useState('');
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadComments = useCallback(async () => {
    setCommentsLoading(true);
    try {
      const data = await getComments(id);
      setComments(data);
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setCommentsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    async function load() {
      try {
        const data = await getFeatureRequest(id);
        setRequest(data);
        setAdminStatus(data.status);
        setAdminResponse(data.admin_response || '');
      } catch (err) {
        if (err.message?.includes('404') || err.message?.includes('not found')) {
          setError('This feature request was not found or has been removed.');
        } else {
          setError(err.message || 'Failed to load feature request');
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  useEffect(() => {
    if (!loading && !error && request) {
      loadComments();
    }
  }, [loading, error, request, loadComments]);

  const handleUpvoteToggle = (result) => {
    setRequest((prev) => ({
      ...prev,
      upvote_count: result.upvote_count,
      user_has_upvoted: result.upvoted,
    }));
  };

  const handleAdminSave = async () => {
    setSavingAdmin(true);
    try {
      const data = { status: adminStatus };
      if (adminResponse.trim()) {
        data.admin_response = adminResponse.trim();
      }
      const updated = await updateFeatureStatus(id, data);
      setRequest(updated);
      showSuccess('Status and response updated');
    } catch (err) {
      showError(err.message || 'Failed to update status');
    } finally {
      setSavingAdmin(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this feature request? This action cannot be undone.')) {
      return;
    }
    setDeleting(true);
    try {
      await deleteFeatureRequest(id);
      showSuccess('Feature request deleted');
      navigate('/feature-requests');
    } catch (err) {
      showError(err.message || 'Failed to delete feature request');
      setDeleting(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setSubmittingComment(true);
    try {
      const comment = await addComment(id, newComment.trim());
      setComments((prev) => [...prev, comment]);
      setNewComment('');
      setRequest((prev) => ({
        ...prev,
        comment_count: (prev.comment_count || 0) + 1,
      }));
      showSuccess('Comment posted');
    } catch (err) {
      showError(err.message || 'Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleEditComment = (comment) => {
    setEditingCommentId(comment.id);
    setEditingContent(comment.content);
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditingContent('');
  };

  const handleSaveEdit = async (commentId) => {
    if (!editingContent.trim()) return;
    try {
      const updated = await updateComment(id, commentId, editingContent.trim());
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? updated : c))
      );
      setEditingCommentId(null);
      setEditingContent('');
      showSuccess('Comment updated');
    } catch (err) {
      showError(err.message || 'Failed to update comment');
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await deleteComment(id, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setRequest((prev) => ({
        ...prev,
        comment_count: Math.max((prev.comment_count || 1) - 1, 0),
      }));
      showSuccess('Comment deleted');
    } catch (err) {
      showError(err.message || 'Failed to delete comment');
    }
  };

  if (loading) {
    return (
      <div className="fr-detail-page">
        <div className="fr-detail-page__loading">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fr-detail-page">
        <div className="fr-detail-page__error">
          <p>{error}</p>
          <Link to="/feature-requests" className="btn btn-secondary">
            Back to Feature Requests
          </Link>
        </div>
      </div>
    );
  }

  if (!request) return null;

  const isAdmin = user?.is_admin;
  const categoryColor = CATEGORY_COLORS[request.category] || { bg: '#f3f4f6', color: '#374151' };
  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'U';

  return (
    <div className="fr-detail-page">
      <div className="fr-detail-page__breadcrumbs">
        <Link to="/dashboard">Dashboard</Link>
        <span className="breadcrumb-sep">/</span>
        <Link to="/feature-requests">Feature Requests</Link>
        <span className="breadcrumb-sep">/</span>
        <span>FR-{request.id.substring(0, 8)}</span>
      </div>

      <div className="fr-detail-page__title-row">
        <div className="fr-detail-page__title-left">
          <UpvoteButton
            featureRequestId={request.id}
            count={request.upvote_count}
            upvoted={request.user_has_upvoted}
            onToggle={handleUpvoteToggle}
          />
          <h1 className="fr-detail-page__title">{request.title}</h1>
        </div>
        <div className="fr-detail-page__title-badges">
          <span className={`badge ${STATUS_CLASSES[request.status] || ''}`}>
            {STATUS_LABELS[request.status] || request.status}
          </span>
          <span
            className="badge fr-detail-page__category-badge"
            style={{ background: categoryColor.bg, color: categoryColor.color }}
          >
            {CATEGORY_LABELS[request.category] || request.category}
          </span>
        </div>
      </div>

      <div className="fr-detail-page__grid">
        <div className="fr-detail-page__content">
          {/* Description Card */}
          <div className="detail-card">
            <h3 className="detail-card__label">Description</h3>
            <p className="detail-card__value">{request.description}</p>
          </div>

          {/* Admin Response Box */}
          {request.admin_response && (
            <div className="fr-detail-page__admin-response">
              <h3 className="detail-card__label">Admin Response</h3>
              <p className="detail-card__value">{request.admin_response}</p>
            </div>
          )}

          {/* Comments Section */}
          <div className="fr-detail-page__comments">
            <h3 className="fr-detail-page__comments-header">
              Comments ({request.comment_count || 0})
            </h3>

            {commentsLoading ? (
              <div className="fr-detail-page__comments-loading">Loading comments...</div>
            ) : comments.length === 0 ? (
              <div className="fr-detail-page__comments-empty">
                No comments yet. Be the first to share your thoughts.
              </div>
            ) : (
              <div className="fr-detail-page__comment-list">
                {comments.map((comment) => {
                  const commentInitial = comment.user_name
                    ? comment.user_name.charAt(0).toUpperCase()
                    : '?';
                  const canEdit =
                    user?.id === comment.user_id || isAdmin;
                  const isEditing = editingCommentId === comment.id;

                  return (
                    <div key={comment.id} className="fr-comment">
                      <div className="fr-comment__avatar">{commentInitial}</div>
                      <div className="fr-comment__body">
                        <div className="fr-comment__meta">
                          <span className="fr-comment__author">{comment.user_name}</span>
                          <span className="fr-comment__date">
                            {formatCommentDate(comment.created_at)}
                          </span>
                          {comment.updated_at !== comment.created_at && (
                            <span className="fr-comment__edited">(edited)</span>
                          )}
                        </div>
                        {isEditing ? (
                          <div className="fr-comment__edit-form">
                            <textarea
                              className="fr-comment__edit-textarea"
                              value={editingContent}
                              onChange={(e) => setEditingContent(e.target.value)}
                              rows={3}
                            />
                            <div className="fr-comment__edit-actions">
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => handleSaveEdit(comment.id)}
                                disabled={!editingContent.trim()}
                              >
                                Save
                              </button>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={handleCancelEdit}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="fr-comment__content">{comment.content}</p>
                            {canEdit && (
                              <div className="fr-comment__actions">
                                <button
                                  className="fr-comment__action-btn"
                                  onClick={() => handleEditComment(comment)}
                                >
                                  Edit
                                </button>
                                <button
                                  className="fr-comment__action-btn fr-comment__action-btn--danger"
                                  onClick={() => handleDeleteComment(comment.id)}
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add Comment Input */}
            <div className="fr-detail-page__add-comment">
              <div className="fr-comment__avatar">{userInitial}</div>
              <div className="fr-detail-page__add-comment-form">
                <textarea
                  className="fr-detail-page__comment-input"
                  placeholder="Add a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={3}
                />
                <button
                  className="btn btn-primary"
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || submittingComment}
                >
                  {submittingComment ? 'Posting...' : 'Post Comment'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="fr-detail-page__sidebar">
          <div className="detail-card">
            {/* Admin Controls */}
            {isAdmin && (
              <>
                <div className="sidebar-field">
                  <span className="sidebar-field__label">Status</span>
                  <select
                    className="form-select sidebar-status-select"
                    value={adminStatus}
                    onChange={(e) => setAdminStatus(e.target.value)}
                  >
                    <option value="submitted">Submitted</option>
                    <option value="under_review">Under Review</option>
                    <option value="planned">Planned</option>
                    <option value="in_progress">In Progress</option>
                    <option value="shipped">Shipped</option>
                    <option value="declined">Declined</option>
                  </select>
                </div>
                <div className="sidebar-divider" />
                <div className="sidebar-field">
                  <span className="sidebar-field__label">Admin Response</span>
                  <textarea
                    className="fr-detail-page__admin-textarea"
                    placeholder="Write a response to the user..."
                    value={adminResponse}
                    onChange={(e) => setAdminResponse(e.target.value)}
                    rows={4}
                  />
                </div>
                <button
                  className="btn btn-primary fr-detail-page__admin-save-btn"
                  onClick={handleAdminSave}
                  disabled={savingAdmin}
                >
                  {savingAdmin ? 'Saving...' : 'Save Changes'}
                </button>
                <div className="sidebar-divider" />
              </>
            )}

            {/* Non-admin status display */}
            {!isAdmin && (
              <>
                <div className="sidebar-field">
                  <span className="sidebar-field__label">Status</span>
                  <span className={`badge ${STATUS_CLASSES[request.status] || ''}`}>
                    {STATUS_LABELS[request.status] || request.status}
                  </span>
                </div>
                <div className="sidebar-divider" />
              </>
            )}

            <div className="sidebar-field">
              <span className="sidebar-field__label">Category</span>
              <span
                className="badge"
                style={{ background: categoryColor.bg, color: categoryColor.color }}
              >
                {CATEGORY_LABELS[request.category] || request.category}
              </span>
            </div>
            <div className="sidebar-divider" />

            <div className="sidebar-field">
              <span className="sidebar-field__label">Submitted By</span>
              <span className="sidebar-field__value">{request.submitter_name}</span>
            </div>
            <div className="sidebar-divider" />

            <div className="sidebar-field">
              <span className="sidebar-field__label">Created</span>
              <span className="sidebar-field__value">{formatDate(request.created_at)}</span>
            </div>
            <div className="sidebar-divider" />

            <div className="sidebar-field">
              <span className="sidebar-field__label">Comments</span>
              <span className="sidebar-field__value">{request.comment_count || 0}</span>
            </div>

            {/* Admin Delete Button */}
            {isAdmin && (
              <>
                <div className="sidebar-divider" />
                <button
                  className="btn fr-detail-page__delete-btn"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? 'Deleting...' : 'Delete Feature Request'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
