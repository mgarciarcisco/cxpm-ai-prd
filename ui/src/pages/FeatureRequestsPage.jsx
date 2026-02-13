import { useState, useEffect } from 'react';
import { getFeatureRequests, createFeatureRequest } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { Modal } from '../components/common/Modal';
import EmptyState from '../components/common/EmptyState';
import FeatureRequestCard from '../components/feature-requests/FeatureRequestCard';
import './FeatureRequestsPage.css';

const CATEGORIES = [
  { value: '', label: 'All' },
  { value: 'requirements', label: 'Requirements' },
  { value: 'jira_integration', label: 'Jira Integration' },
  { value: 'export', label: 'Export' },
  { value: 'ui_ux', label: 'UI/UX' },
  { value: 'new_capability', label: 'New Capability' },
];

export default function FeatureRequestsPage() {
  const { showSuccess, showError } = useToast();
  const [requests, setRequests] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('newest');
  const [category, setCategory] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('requirements');
  const [submitting, setSubmitting] = useState(false);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const data = await getFeatureRequests(page, 20, sort, '', category);
      setRequests(data.items);
      setTotal(data.total);
    } catch (err) {
      console.error('Failed to load feature requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRequests(); }, [page, sort, category]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formTitle.trim() || !formDescription.trim()) return;
    setSubmitting(true);
    try {
      await createFeatureRequest({
        title: formTitle.trim(),
        description: formDescription.trim(),
        category: formCategory,
      });
      showSuccess('Feature request submitted');
      setShowModal(false);
      setFormTitle('');
      setFormDescription('');
      setFormCategory('requirements');
      setPage(1);
      loadRequests();
    } catch (err) {
      showError(err.message || 'Failed to submit feature request');
    } finally {
      setSubmitting(false);
    }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="fr-page">
      <div className="fr-page__header">
        <div>
          <h1 className="fr-page__title">Feature Requests</h1>
          <p className="fr-page__subtitle">Vote and comment on ideas to shape the product roadmap</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + New Request
        </button>
      </div>

      <div className="fr-page__toolbar">
        <div className="fr-page__sort">
          <button className={`sort-tab ${sort === 'newest' ? 'sort-tab--active' : ''}`} onClick={() => { setSort('newest'); setPage(1); }}>
            Newest
          </button>
          <button className={`sort-tab ${sort === 'most_upvoted' ? 'sort-tab--active' : ''}`} onClick={() => { setSort('most_upvoted'); setPage(1); }}>
            Most Upvoted
          </button>
        </div>
        <div className="fr-page__filters">
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              className={`filter-pill ${category === cat.value ? 'filter-pill--active' : ''}`}
              onClick={() => { setCategory(cat.value); setPage(1); }}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div className="fr-page__list">
        {loading ? (
          [1, 2, 3].map(i => <div key={i} className="skeleton-card" />)
        ) : requests.length === 0 ? (
          <EmptyState
            title="No feature requests yet"
            description="Be the first to submit a feature request!"
          />
        ) : (
          requests.map(req => (
            <FeatureRequestCard key={req.id} request={req} />
          ))
        )}
      </div>

      {!loading && totalPages > 1 && (
        <div className="pagination">
          <span className="pagination__info">Showing {(page - 1) * 20 + 1}-{Math.min(page * 20, total)} of {total} requests</span>
          <div className="pagination__buttons">
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i + 1}
                className={`pagination__btn ${page === i + 1 ? 'pagination__btn--active' : ''}`}
                onClick={() => setPage(i + 1)}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      )}

      {showModal && (
        <Modal
          onClose={() => setShowModal(false)}
          title="Submit Feature Request"
          subtitle="Share your idea to help improve the platform."
          icon={<span style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '48px', height: '48px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #e0f7f6 0%, #dbeafe 100%)',
            fontSize: '1.5rem'
          }}>&#128161;</span>}
        >
          <form onSubmit={handleSubmit} className="fr-modal-form">
            <div className="form-group">
              <label className="form-label">Title <span className="required">*</span></label>
              <input
                type="text"
                className="form-input"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="A short, descriptive title for your request"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Description <span className="required">*</span></label>
              <textarea
                className="form-textarea"
                rows={4}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Be specific about what problem this would solve."
                required
              />
              <span className="form-hint">Be specific about what problem this would solve.</span>
            </div>
            <div className="form-group">
              <label className="form-label">Category <span className="required">*</span></label>
              <select className="form-select" value={formCategory} onChange={(e) => setFormCategory(e.target.value)}>
                <option value="requirements">Requirements</option>
                <option value="jira_integration">Jira Integration</option>
                <option value="export">Export</option>
                <option value="ui_ux">UI/UX</option>
                <option value="new_capability">New Capability</option>
              </select>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={submitting}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitting || !formTitle.trim() || !formDescription.trim()}>
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
