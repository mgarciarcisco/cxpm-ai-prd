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
 * @property {StageStatus} status - Current status of the stage
 */

const DEFAULT_STAGES = [
  { id: 'requirements', label: 'Requirements' },
  { id: 'prd', label: 'PRD' },
  { id: 'stories', label: 'User Stories' },
  { id: 'mockups', label: 'Mockups' },
  { id: 'export', label: 'Export' },
];

/**
 * Returns the status indicator character based on stage status
 * @param {StageStatus} status
 * @returns {string}
 */
function getStatusIndicator(status) {
  switch (status) {
    case 'complete':
      return '●';
    case 'in_progress':
      return '◐';
    case 'empty':
    default:
      return '○';
  }
}

/**
 * Horizontal stepper showing project stages
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
        {stages.map((stage, index) => {
          const status = statuses[stage.id] || 'empty';
          const isCurrent = currentStage === stage.id;
          const isLast = index === stages.length - 1;

          return (
            <li key={stage.id} className="stage-stepper__item">
              <button
                type="button"
                className={`stage-stepper__stage ${isCurrent ? 'stage-stepper__stage--current' : ''} stage-stepper__stage--${status}`}
                onClick={() => onStageClick?.(stage.id)}
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={`${stage.label}: ${status.replace('_', ' ')}`}
              >
                <span className="stage-stepper__indicator" aria-hidden="true">
                  {getStatusIndicator(status)}
                </span>
                <span className="stage-stepper__label">
                  {stage.label}
                </span>
              </button>
              {!isLast && (
                <div className="stage-stepper__connector" aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default StageStepper;
