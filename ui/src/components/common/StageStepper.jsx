import './StageStepper.css';

/**
 * Stage status values
 * @typedef {'empty' | 'in_progress' | 'complete'} StageStatus
 */

/**
 * Stage configuration
 * @typedef {Object} Stage
 * @property {string} id - Unique stage identifier
 * @property {string} label - Display label for the stage
 * @property {string} icon - Emoji icon for the stage
 * @property {StageStatus} status - Current status of the stage
 */

const DEFAULT_STAGES = [
  { id: 'requirements', label: 'Requirements', icon: '📝' },
  { id: 'prd', label: 'PRD', icon: '📄' },
  { id: 'stories', label: 'Stories', icon: '📋' },
  { id: 'mockups', label: 'Mockups', icon: '🎨' },
  { id: 'export', label: 'Export', icon: '📦' },
];

/**
 * Returns the status text based on stage status
 * @param {StageStatus} status
 * @returns {string}
 */
function getStatusText(status) {
  switch (status) {
    case 'complete':
      return 'Complete';
    case 'in_progress':
      return 'In Progress';
    case 'empty':
    default:
      return 'Pending';
  }
}

/**
 * Modern pill-style stepper showing project stages
 * @param {Object} props
 * @param {Object<string, StageStatus>} props.statuses - Map of stage id to status
 * @param {string} [props.currentStage] - ID of the currently active stage
 * @param {(stageId: string) => void} [props.onStageClick] - Callback when a stage is clicked
 * @param {Stage[]} [props.stages] - Custom stage definitions (defaults to 5 standard stages)
 */
export function StageStepper({
  statuses = {},
  currentStage,
  onStageClick,
  stages = DEFAULT_STAGES
}) {
  return (
    <nav className="stage-stepper" aria-label="Project stages">
      <ol className="stage-stepper__list">
        {stages.map((stage) => {
          const status = statuses[stage.id] || 'empty';
          const isCurrent = currentStage === stage.id;
          const statusClass = status === 'empty' ? 'pending' : status.replace('_', '-');

          return (
            <li key={stage.id} className="stage-stepper__item">
              <button
                type="button"
                className={`stage-stepper__step stage-stepper__step--${statusClass} ${isCurrent ? 'stage-stepper__step--current' : ''}`}
                onClick={() => onStageClick?.(stage.id)}
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={`${stage.label}: ${getStatusText(status)}`}
              >
                <span className="stage-stepper__icon" aria-hidden="true">
                  {status === 'complete' ? '✓' : stage.icon}
                </span>
                <span className="stage-stepper__content">
                  <span className="stage-stepper__label">{stage.label}</span>
                  <span className="stage-stepper__status">{getStatusText(status)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default StageStepper;
