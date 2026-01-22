import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { FileDropzone } from '../components/common/FileDropzone';
import './UploadMeetingPage.css';

const MAX_FILE_SIZE_KB = 50;
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function UploadMeetingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split('T')[0]);
  const [file, setFile] = useState(null);
  const [text, setText] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileSelect = (selectedFile) => {
    setError(null);

    if (!selectedFile) {
      setFile(null);
      return;
    }

    // Validate file size (50KB limit)
    const fileSizeKB = selectedFile.size / 1024;
    if (fileSizeKB > MAX_FILE_SIZE_KB) {
      setError(`File too large. Maximum size is ${MAX_FILE_SIZE_KB}KB. Your file is ${fileSizeKB.toFixed(1)}KB.`);
      setFile(null);
      return;
    }

    setFile(selectedFile);
    // Clear text input when file is selected
    if (selectedFile) {
      setText('');
    }
  };

  const handleTextChange = (e) => {
    setText(e.target.value);
    // Clear file when text is entered
    if (e.target.value) {
      setFile(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('project_id', id);
      formData.append('title', title);
      formData.append('meeting_date', meetingDate);

      if (file) {
        formData.append('file', file);
      } else if (text.trim()) {
        formData.append('text', text.trim());
      }

      const response = await fetch(`${API_BASE_URL}/api/meetings/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Upload failed with status ${response.status}`);
      }

      const data = await response.json();
      // Navigate to the meeting page with the job_id
      navigate(`/app/projects/${id}/meetings/${data.meeting_id}`, {
        state: { job_id: data.job_id }
      });
    } catch (err) {
      setError(err.message || 'Failed to upload meeting notes. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const isSubmitDisabled = isLoading || !title.trim() || (!file && !text.trim());

  return (
    <main className="main-content">
      <section className="upload-section">
        <div className="section-header">
          <h2>Upload Meeting Notes</h2>
          <Link to={`/app/projects/${id}`} className="back-link">Back to Project</Link>
        </div>

        <form className="upload-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="title" className="form-label">
              Meeting Title <span className="required">*</span>
            </label>
            <input
              id="title"
              type="text"
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Sprint Planning, User Research Session"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="meeting-date" className="form-label">
              Meeting Date
            </label>
            <input
              id="meeting-date"
              type="date"
              className="form-input form-input--date"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Upload File
            </label>
            <FileDropzone
              onFile={handleFileSelect}
              accept=".txt,.md"
            />
            <p className="form-hint">Upload a .txt or .md file (max {MAX_FILE_SIZE_KB}KB)</p>
          </div>

          <div className="form-divider">
            <span>or</span>
          </div>

          <div className="form-group">
            <label htmlFor="text-input" className="form-label">
              Paste Meeting Notes
            </label>
            <textarea
              id="text-input"
              className="form-textarea"
              value={text}
              onChange={handleTextChange}
              placeholder="Paste your meeting notes here..."
              rows={10}
              disabled={!!file}
            />
            {file && (
              <p className="form-hint form-hint--info">Clear the uploaded file to paste text instead.</p>
            )}
          </div>

          {error && (
            <div className="form-error">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12zM8 5v3M8 11h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div className="form-actions">
            <Link to={`/app/projects/${id}`} className="form-btn form-btn--secondary">
              Cancel
            </Link>
            <button
              type="submit"
              className="form-btn form-btn--primary"
              disabled={isSubmitDisabled}
            >
              {isLoading ? (
                <>
                  <span className="btn-spinner"></span>
                  Uploading...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14 10V12.6667C14 13.0203 13.8595 13.3594 13.6095 13.6095C13.3594 13.8595 13.0203 14 12.6667 14H3.33333C2.97971 14 2.64057 13.8595 2.39052 13.6095C2.14048 13.3594 2 13.0203 2 12.6667V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M11.3333 5.33333L8 2L4.66666 5.33333" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M8 2V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Process Meeting Notes
                </>
              )}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

export default UploadMeetingPage;
