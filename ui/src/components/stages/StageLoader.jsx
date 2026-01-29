import { LoadingSpinner } from '../common/LoadingSpinner';
import './StageLoader.css';

/**
 * Consistent loading state component for stages.
 * Displays a centered spinner with an optional message.
 *
 * @param {Object} props
 * @param {string} [props.message] - Loading message to display (e.g., "Loading requirements...")
 * @param {'small'|'medium'|'large'} [props.size='medium'] - Spinner size
 * @param {string} [props.stage] - Stage name for theming ('requirements'|'prd'|'stories'|'mockups'|'export')
 */
export function StageLoader({ message = 'Loading...', size = 'medium', stage }) {
  const stageClass = stage ? `stage-loader--${stage}` : '';

  return (
    <div className={`stage-loader ${stageClass}`}>
      <LoadingSpinner size={size} />
      {message && <p className="stage-loader__message">{message}</p>}
    </div>
  );
}

export default StageLoader;
