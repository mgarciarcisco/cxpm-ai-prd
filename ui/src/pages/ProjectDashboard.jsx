import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { get } from '../services/api';
import MeetingsList from '../components/meetings/MeetingsList';
import LoadingSpinner from '../components/common/LoadingSpinner';
import './ProjectDashboard.css';

function ProjectDashboard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [projectData, meetingsData] = await Promise.all([
        get(`/api/projects/${id}`),
        get(`/api/projects/${id}/meetings`)
      ]);
      setProject(projectData);
      setMeetings(meetingsData || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMeetingClick = (meeting) => {
    navigate(`/app/projects/${id}/meetings/${meeting.id}`);
  };

  const handleExport = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/projects/${id}/requirements/export`);
      if (!response.ok) {
        throw new Error('Export failed');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const filename = project?.name
        ? `${project.name.toLowerCase().replace(/\s+/g, '-')}-requirements.md`
        : 'requirements.md';
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  if (loading) {
    return (
      <main className="main-content">
        <div className="dashboard-loading">
          <LoadingSpinner size="large" />
          <p>Loading project...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="main-content">
        <div className="dashboard-error">
          <p>Error loading project: {error}</p>
          <button onClick={fetchData} className="retry-btn">Retry</button>
        </div>
      </main>
    );
  }

  return (
    <main className="main-content">
      <section className="dashboard-section">
        <div className="section-header">
          <h2>{project?.name || 'Project Dashboard'}</h2>
          <Link to="/app" className="back-link">Back to Projects</Link>
        </div>

        {project?.description && (
          <p className="dashboard-description">{project.description}</p>
        )}

        <div className="dashboard-actions">
          <Link to={`/app/projects/${id}/meetings/new`} className="dashboard-btn dashboard-btn--primary">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 3.33334V12.6667" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3.33334 8H12.6667" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Add Meeting
          </Link>
          <Link to={`/app/projects/${id}/requirements`} className="dashboard-btn dashboard-btn--secondary">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 4.66667H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 8H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 11.3333H10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            View Requirements
          </Link>
          <button onClick={handleExport} className="dashboard-btn dashboard-btn--secondary">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14 10V12.6667C14 13.0203 13.8595 13.3594 13.6095 13.6095C13.3594 13.8595 13.0203 14 12.6667 14H3.33333C2.97971 14 2.64057 13.8595 2.39052 13.6095C2.14048 13.3594 2 13.0203 2 12.6667V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4.66666 6.66667L8 10L11.3333 6.66667" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M8 10V2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Export
          </button>
        </div>

        <div className="dashboard-content">
          <div className="dashboard-panel dashboard-panel--meetings">
            <h3 className="panel-title">Meetings</h3>
            <MeetingsList
              meetings={meetings}
              onMeetingClick={handleMeetingClick}
              emptyActionButton={
                <Link to={`/app/projects/${id}/meetings/new`} className="empty-state-link-btn">
                  Add Meeting
                </Link>
              }
            />
          </div>

          <div className="dashboard-panel dashboard-panel--requirements">
            <h3 className="panel-title">Requirements Summary</h3>
            <div className="requirements-summary-placeholder">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M38 8H10C7.79086 8 6 9.79086 6 12V38C6 40.2091 7.79086 42 10 42H38C40.2091 42 42 40.2091 42 38V12C42 9.79086 40.2091 8 38 8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 16H32" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 24H32" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 32H26" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p>Apply meeting recaps to build your working requirements document.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default ProjectDashboard;
