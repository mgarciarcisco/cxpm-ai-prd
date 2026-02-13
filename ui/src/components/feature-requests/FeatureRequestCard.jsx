import { Link } from 'react-router-dom';
import UpvoteButton from './UpvoteButton';
import './FeatureRequestCard.css';

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

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function FeatureRequestCard({ request, onUpvoteToggle }) {
  const catColor = CATEGORY_COLORS[request.category] || CATEGORY_COLORS.requirements;

  return (
    <div className="fr-card">
      <UpvoteButton
        featureRequestId={request.id}
        count={request.upvote_count}
        upvoted={request.user_has_upvoted}
        onToggle={onUpvoteToggle}
      />
      <Link to={`/feature-requests/${request.id}`} className="fr-card__content">
        <h3 className="fr-card__title">{request.title}</h3>
        <p className="fr-card__description">{request.description}</p>
        <div className="fr-card__meta">
          <span className="fr-card__category" style={{ background: catColor.bg, color: catColor.color }}>
            {CATEGORY_LABELS[request.category] || request.category}
          </span>
          <span className={`badge ${STATUS_CLASSES[request.status] || ''}`}>
            {(request.status || '').replace(/_/g, ' ')}
          </span>
          <span className="fr-card__author">{request.submitter_name}</span>
          <span className="fr-card__comments">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 10V2.5A1.5 1.5 0 0 1 2.5 1h9A1.5 1.5 0 0 1 13 2.5v5A1.5 1.5 0 0 1 11.5 9H4l-3 3v-2z"/></svg>
            {request.comment_count}
          </span>
          <span className="fr-card__date">{formatDate(request.created_at)}</span>
        </div>

        {request.admin_response && (
          <div className="fr-card__admin-response">
            <span className="fr-card__admin-label">Admin Response</span>
            <p className="fr-card__admin-text">{request.admin_response}</p>
          </div>
        )}
      </Link>
    </div>
  );
}
