import { useState } from 'react';
import { useParams, Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import Breadcrumbs from '../components/common/Breadcrumbs';
import { FileDropzone } from '../components/common/FileDropzone';
import './UploadMeetingPage.css';

const MAX_FILE_SIZE_KB = 50;
const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:8000');

function UploadMeetingPage() {
  const { id: projectId } = useParams(); // projectId may be undefined for dashboard flow
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Determine if we're in project context or standalone (dashboard) flow
  const hasProjectContext = Boolean(projectId);

  // Project name passed via navigation state (from RequirementsStage, ProjectDashboard, etc.)
  const projectName = location.state?.projectName || 'Project';

  // Support returnTo param for navigating back to the originating page
  const returnTo = searchParams.get('returnTo') || (hasProjectContext ? `/projects/${projectId}` : '/dashboard');
  const [title, setTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split('T')[0]);
  const [file, setFile] = useState(null);
  const [text, setText] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Breadcrumb items
  const breadcrumbItems = hasProjectContext
    ? [
        { label: 'Dashboard', href: '/dashboard' },
        { label: projectName, href: `/projects/${projectId}` },
        { label: 'Add Meeting' },
      ]
    : [
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Convert Meeting Notes' },
      ];

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
    // Note: User can now have both file AND text - no longer mutually exclusive
  };

  const handleTextChange = (e) => {
    setText(e.target.value);
    // Note: User can now have both file AND text - no longer mutually exclusive
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('meeting_date', meetingDate);
      
      // Only include project_id if we have project context
      if (hasProjectContext) {
        formData.append('project_id', projectId);
      }

      // User can provide file, text, or both
      if (file) {
        formData.append('file', file);
      }
      if (text.trim()) {
        formData.append('text', text.trim());
      }

      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/api/meetings/upload`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Upload failed with status ${response.status}`);
      }

      const data = await response.json();
      
      // Navigate to the appropriate meeting page based on context
      if (hasProjectContext) {
        // Project flow: go to project-scoped meeting page
        navigate(`/app/projects/${projectId}/meetings/${data.meeting_id}`, {
          state: { job_id: data.job_id }
        });
      } else {
        // Dashboard flow: go to standalone meeting page (will pick project later)
        navigate(`/app/meetings/${data.meeting_id}`, {
          state: { job_id: data.job_id }
        });
      }
    } catch (err) {
      setError(err.message || 'Failed to upload meeting notes. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const isSubmitDisabled = isLoading || !title.trim() || (!file && !text.trim());

  // Helper text for disabled button
  const getDisabledReason = () => {
    if (!title.trim()) return 'Enter a meeting title to continue';
    if (!file && !text.trim()) return 'Upload a file or paste notes to continue';
    return '';
  };

  return (
    <main className="main-content">
      <Breadcrumbs items={breadcrumbItems} />

      <section className="upload-section">
        {/* Page Header - Title matches Dashboard card */}
        <div className="upload-header">
          <h1>Convert Meeting Notes to Requirements</h1>
          <p className="upload-header__subtitle">
            Upload or paste your meeting notes to extract structured requirements
          </p>
        </div>

        <div className="upload-layout">
          {/* Form */}
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
              <span>and / or</span>
            </div>

            <div className="form-group">
              <label htmlFor="text-input" className="form-label">
                Paste Additional Notes
              </label>
              <textarea
                id="text-input"
                className="form-textarea"
                value={text}
                onChange={handleTextChange}
                placeholder="Paste your meeting notes, transcript, or summary here..."
                rows={10}
              />
              {file && text.trim() && (
                <p className="form-hint form-hint--info">
                  Both file and pasted notes will be processed together.
                </p>
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
              <Link to={returnTo} className="form-btn form-btn--secondary">
                Cancel
              </Link>
              <div
                className="btn-wrapper"
                title={isSubmitDisabled ? getDisabledReason() : ''}
              >
                <button
                  type="submit"
                  className="form-btn form-btn--primary"
                  disabled={isSubmitDisabled}
                >
                  {isLoading ? (
                    <>
                      <span className="btn-spinner"></span>
                      Processing...
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
            </div>
          </form>

          {/* Tips Panel */}
          <aside className="tips-panel">
            <div className="tips-panel__header">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 16v-4M12 8h.01"/>
              </svg>
              Tips for Best Results
            </div>
            <ul className="tips-panel__list">
              <li>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13.5 4.5L6 12L2.5 8.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>Include action items and decisions made</span>
              </li>
              <li>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13.5 4.5L6 12L2.5 8.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>Note any risks or concerns discussed</span>
              </li>
              <li>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13.5 4.5L6 12L2.5 8.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>Capture open questions that need answers</span>
              </li>
              <li>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13.5 4.5L6 12L2.5 8.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>Works with Webex transcripts, AI summaries, or manual notes</span>
              </li>
            </ul>
            <div className="tips-panel__example">
              <div className="tips-panel__example-label">Example Format</div>
              <div className="tips-panel__example-text">
                Meeting: Sprint 12 Planning{'\n'}
                Date: Feb 2, 2026{'\n'}
                {'\n'}
                Decisions:{'\n'}
                - Use React for the new dashboard{'\n'}
                - API deadline is March 15{'\n'}
                {'\n'}
                Risks:{'\n'}
                - Team capacity is limited...
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

export default UploadMeetingPage;
