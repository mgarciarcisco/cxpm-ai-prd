import { useState, useEffect } from 'react';
import { post } from '../../services/api';
import './MergeEditor.css';

/**
 * MergeEditor component displays an editable textarea with AI-suggested merged text
 * for resolving conflicts between existing requirements and new meeting items.
 *
 * @param {string} existingContent - Content of the existing requirement
 * @param {string} newContent - Content of the new meeting item
 * @param {function} onSave - Callback when user saves the merged text
 * @param {function} onCancel - Callback when user cancels merging
 */
export function MergeEditor({
  existingContent,
  newContent,
  onSave,
  onCancel
}) {
  const [mergedText, setMergedText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMergeSuggestion();
  }, [existingContent, newContent]);

  const fetchMergeSuggestion = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await post('/api/meetings/suggest-merge', {
        existing: existingContent,
        new: newContent
      });

      setMergedText(response.merged_text || '');
    } catch (err) {
      setError(err.message);
      // Pre-fill with both contents as fallback
      setMergedText(`${existingContent}\n\n${newContent}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (onSave && mergedText.trim()) {
      onSave(mergedText.trim());
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  const handleRetry = () => {
    fetchMergeSuggestion();
  };

  if (loading) {
    return (
      <div className="merge-editor">
        <div className="merge-editor-loading">
          <div className="merge-editor-spinner"></div>
          <p>Generating merge suggestion...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="merge-editor">
      <div className="merge-editor-header">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 5L8 11L5 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M2 5L8 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span>Merged Content</span>
        {error && (
          <span className="merge-editor-error-badge" title={error}>
            AI suggestion failed
          </span>
        )}
      </div>

      {error && (
        <div className="merge-editor-error">
          <p>Failed to get AI suggestion: {error}</p>
          <button onClick={handleRetry} className="merge-editor-retry-btn" type="button">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1.167 7A5.833 5.833 0 1 0 2.917 3.5M1.167 1.167v2.333h2.333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Retry
          </button>
        </div>
      )}

      <textarea
        className="merge-editor-textarea"
        value={mergedText}
        onChange={(e) => setMergedText(e.target.value)}
        placeholder="Edit the merged content..."
        rows={6}
      />

      <div className="merge-editor-hint">
        Edit the text above to combine both requirements as needed.
      </div>

      <div className="merge-editor-actions">
        <button
          onClick={handleCancel}
          className="merge-editor-cancel-btn"
          type="button"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="merge-editor-save-btn"
          type="button"
          disabled={!mergedText.trim()}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M11.667 3.5L5.25 9.917L2.333 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Save Merged Text
        </button>
      </div>
    </div>
  );
}

export default MergeEditor;
