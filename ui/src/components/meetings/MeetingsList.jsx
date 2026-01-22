import { StatusBadge } from '../common/StatusBadge';
import './MeetingsList.css';

function MeetingsList({ meetings, onMeetingClick }) {
  const formatDate = (dateString) => {
    if (!dateString) return 'No date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (!meetings || meetings.length === 0) {
    return (
      <div className="meetings-list-empty">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M38 8H10C7.79086 8 6 9.79086 6 12V38C6 40.2091 7.79086 42 10 42H38C40.2091 42 42 40.2091 42 38V12C42 9.79086 40.2091 8 38 8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M32 4V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M16 4V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M6 20H42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <p>No meetings yet</p>
      </div>
    );
  }

  return (
    <ul className="meetings-list">
      {meetings.map((meeting) => (
        <li
          key={meeting.id}
          className="meetings-list-item"
          onClick={() => onMeetingClick(meeting)}
        >
          <div className="meetings-list-item-content">
            <h4 className="meetings-list-item-title">{meeting.title}</h4>
            <span className="meetings-list-item-date">
              {formatDate(meeting.meeting_date)}
            </span>
          </div>
          <StatusBadge status={meeting.status} />
        </li>
      ))}
    </ul>
  );
}

export default MeetingsList;
