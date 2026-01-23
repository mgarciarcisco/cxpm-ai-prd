import { useState } from 'react';
import { put, del } from '../../services/api';
import './ItemRow.css';

export function ItemRow({ item, onEdit, onDelete }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(item.content);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const handleEditClick = (e) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditedContent(item.content);
    setError(null);
  };

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    setIsConfirmingDelete(true);
    setDeleteError(null);
  };

  const handleCancelDelete = (e) => {
    e.stopPropagation();
    setIsConfirmingDelete(false);
    setDeleteError(null);
  };

  const handleConfirmDelete = async (e) => {
    e.stopPropagation();
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await del(`/api/meeting-items/${item.id}`);
      setIsConfirmingDelete(false);
      // Notify parent of the deletion
      if (onDelete) {
        onDelete(item);
      }
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete item');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelEdit = (e) => {
    e.stopPropagation();
    setIsEditing(false);
    setEditedContent(item.content);
    setError(null);
  };

  const handleSaveEdit = async (e) => {
    e.stopPropagation();
    if (!editedContent.trim()) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const updatedItem = await put(`/api/meeting-items/${item.id}`, {
        content: editedContent.trim()
      });
      setIsEditing(false);
      // Notify parent of the update
      if (onEdit) {
        onEdit(updatedItem);
      }
    } catch (err) {
      setError(err.message || 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      handleCancelEdit(e);
    } else if (e.key === 'Enter' && e.ctrlKey) {
      handleSaveEdit(e);
    }
  };

  if (isEditing) {
    return (
      <div className="item-row item-row--editing">
        <div className="item-row-edit-container">
          <textarea
            className="item-row-edit-textarea"
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
            autoFocus
            disabled={isSaving}
          />
          {error && (
            <div className="item-row-edit-error">{error}</div>
          )}
          <div className="item-row-edit-actions">
            <button
              className="item-row-edit-btn item-row-edit-btn--cancel"
              onClick={handleCancelEdit}
              disabled={isSaving}
              type="button"
            >
              Cancel
            </button>
            <button
              className="item-row-edit-btn item-row-edit-btn--save"
              onClick={handleSaveEdit}
              disabled={isSaving || !editedContent.trim()}
              type="button"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isConfirmingDelete) {
    return (
      <div className="item-row item-row--confirming-delete">
        <div className="item-row-delete-container">
          <div className="item-row-delete-message">
            <svg className="item-row-delete-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 6V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 14H10.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Delete this item?</span>
          </div>
          {deleteError && (
            <div className="item-row-delete-error">{deleteError}</div>
          )}
          <div className="item-row-delete-actions">
            <button
              className="item-row-delete-btn item-row-delete-btn--cancel"
              onClick={handleCancelDelete}
              disabled={isDeleting}
              type="button"
            >
              Cancel
            </button>
            <button
              className="item-row-delete-btn item-row-delete-btn--confirm"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              type="button"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="item-row">
      <div className="item-row-drag-handle" aria-label="Drag to reorder">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="6" cy="4" r="1" fill="currentColor" />
          <circle cx="10" cy="4" r="1" fill="currentColor" />
          <circle cx="6" cy="8" r="1" fill="currentColor" />
          <circle cx="10" cy="8" r="1" fill="currentColor" />
          <circle cx="6" cy="12" r="1" fill="currentColor" />
          <circle cx="10" cy="12" r="1" fill="currentColor" />
        </svg>
      </div>
      <div className="item-row-content">
        {item.content}
      </div>
      <div className="item-row-actions">
        <button
          className="item-row-action-btn"
          onClick={handleEditClick}
          aria-label="Edit item"
          type="button"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M11.333 2.00001C11.5081 1.82491 11.7169 1.68602 11.9471 1.59126C12.1773 1.4965 12.4244 1.44772 12.674 1.44772C12.9237 1.44772 13.1707 1.4965 13.4009 1.59126C13.6311 1.68602 13.8399 1.82491 14.015 2.00001C14.1901 2.17511 14.329 2.38394 14.4238 2.61411C14.5185 2.84428 14.5673 3.09136 14.5673 3.34101C14.5673 3.59066 14.5185 3.83773 14.4238 4.0679C14.329 4.29808 14.1901 4.5069 14.015 4.68201L5.00001 13.697L1.33334 14.667L2.30334 11L11.333 2.00001Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <button
          className="item-row-action-btn item-row-action-btn--delete"
          onClick={handleDeleteClick}
          aria-label="Delete item"
          type="button"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 4H3.33333H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M5.33334 4.00001V2.66668C5.33334 2.31305 5.47382 1.97392 5.72387 1.72387C5.97392 1.47382 6.31305 1.33334 6.66668 1.33334H9.33334C9.68697 1.33334 10.0261 1.47382 10.2762 1.72387C10.5262 1.97392 10.6667 2.31305 10.6667 2.66668V4.00001M12.6667 4.00001V13.3333C12.6667 13.687 12.5262 14.0261 12.2762 14.2762C12.0261 14.5262 11.687 14.6667 11.3333 14.6667H4.66668C4.31305 14.6667 3.97392 14.5262 3.72387 14.2762C3.47382 14.0261 3.33334 13.687 3.33334 13.3333V4.00001H12.6667Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

export default ItemRow;
