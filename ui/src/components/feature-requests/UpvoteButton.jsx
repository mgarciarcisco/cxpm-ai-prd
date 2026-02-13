import { useState } from 'react';
import { toggleUpvote } from '../../services/api';
import './UpvoteButton.css';

export default function UpvoteButton({ featureRequestId, count: initialCount, upvoted: initialUpvoted, onToggle }) {
  const [count, setCount] = useState(initialCount);
  const [upvoted, setUpvoted] = useState(initialUpvoted);
  const [loading, setLoading] = useState(false);

  const handleClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;

    // Optimistic update
    const newUpvoted = !upvoted;
    const newCount = count + (newUpvoted ? 1 : -1);
    setUpvoted(newUpvoted);
    setCount(newCount);

    setLoading(true);
    try {
      const result = await toggleUpvote(featureRequestId);
      setUpvoted(result.upvoted);
      setCount(result.upvote_count);
      if (onToggle) onToggle(result);
    } catch (err) {
      // Revert on error
      setUpvoted(!newUpvoted);
      setCount(count);
      console.error('Upvote failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      className={`upvote-btn ${upvoted ? 'upvote-btn--active' : ''}`}
      onClick={handleClick}
      disabled={loading}
      aria-label={upvoted ? 'Remove upvote' : 'Upvote'}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 2L3 8h8L7 2z"/>
      </svg>
      <span className="upvote-btn__count">{count}</span>
    </button>
  );
}
