import { useState, useRef } from 'react';
import { Modal } from './Modal';
import { useToast } from '../../contexts/ToastContext';
import { submitBugReport } from '../../services/api';
import './BugReportModal.css';

export default function BugReportModal({ onClose }) {
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('minor');
  const [steps, setSteps] = useState('');
  const [screenshot, setScreenshot] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      formData.append('severity', severity);
      if (steps.trim()) formData.append('steps_to_reproduce', steps.trim());
      formData.append('page_url', window.location.href);
      formData.append('browser_info', navigator.userAgent);
      if (screenshot) formData.append('screenshot', screenshot);

      await submitBugReport(formData);
      showSuccess('Bug report submitted');
      onClose();
    } catch (err) {
      showError(err.message || 'Failed to submit bug report');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) setScreenshot(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setScreenshot(file);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  return (
    <Modal
      onClose={onClose}
      title="Report a Bug"
      subtitle="Help us improve by reporting issues you've found."
      icon={<span style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '48px',
        height: '48px',
        borderRadius: '12px',
        background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
        fontSize: '1.5rem'
      }}>&#128027;</span>}
      size="large"
    >
      <form onSubmit={handleSubmit} className="bug-report-form">
        <div className="form-group">
          <label className="form-label">Title <span className="required">*</span></label>
          <input
            type="text"
            className="form-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Brief description of the issue"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Description <span className="required">*</span></label>
          <textarea
            className="form-textarea"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What happened? What did you expect?"
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group form-group--half">
            <label className="form-label">Severity</label>
            <select
              className="form-select"
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
            >
              <option value="minor">Minor</option>
              <option value="major">Major</option>
              <option value="blocker">Blocker</option>
            </select>
          </div>
          <div className="form-group form-group--half">
            <label className="form-label">Page URL</label>
            <input
              type="text"
              className="form-input"
              value={window.location.href}
              disabled
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Steps to Reproduce</label>
          <textarea
            className="form-textarea"
            rows={2}
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
            placeholder="Optional. Help us recreate the issue."
          />
        </div>

        <div className="form-group">
          <label className="form-label">Screenshot</label>
          <div
            className={`screenshot-upload ${dragActive ? 'screenshot-upload--active' : ''} ${screenshot ? 'screenshot-upload--has-file' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            {screenshot ? (
              <div className="screenshot-upload__preview">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13.3 4.7L6.3 11.7L2.7 8.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <span>{screenshot.name}</span>
                <button
                  type="button"
                  className="screenshot-upload__remove"
                  onClick={(e) => { e.stopPropagation(); setScreenshot(null); }}
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="screenshot-upload__placeholder">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <path d="M21 15l-5-5L5 21"/>
                </svg>
                <span>Click to upload or drag and drop</span>
                <span className="screenshot-upload__hint">PNG, JPG, GIF, WebP up to 5MB</span>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading || !title.trim() || !description.trim()}>
            {loading ? 'Submitting...' : 'Submit Report'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
