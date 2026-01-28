import './LoadingSpinner.css';

const SIZE_CONFIG = {
  small: 'loading-spinner--small',
  medium: 'loading-spinner--medium',
  large: 'loading-spinner--large',
};

export function LoadingSpinner({ size = 'medium' }) {
  const sizeClass = SIZE_CONFIG[size] || SIZE_CONFIG.medium;

  return (
    <div className={`loading-spinner ${sizeClass}`} role="status" aria-label="Loading">
      <span className="loading-spinner-sr-only">Loading...</span>
    </div>
  );
}

export default LoadingSpinner;
