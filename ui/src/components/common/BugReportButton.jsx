import { useState } from 'react';
import BugReportModal from './BugReportModal';
import './BugReportButton.css';

export default function BugReportButton() {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button
        className="bug-report-fab"
        onClick={() => setShowModal(true)}
        aria-label="Report a bug"
        title="Report a Bug"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </button>
      {showModal && <BugReportModal onClose={() => setShowModal(false)} />}
    </>
  );
}
