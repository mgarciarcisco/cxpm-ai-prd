import './StageFilter.css';

/**
 * Stage filter dropdown component for filtering projects by current stage.
 * @param {Object} props
 * @param {string} props.value - Current filter value
 * @param {Function} props.onChange - Callback when filter changes
 */
export function StageFilter({ value = 'all', onChange }) {
  const stages = [
    { value: 'all', label: 'All Stages' },
    { value: 'requirements', label: 'Requirements' },
    { value: 'prd', label: 'PRD' },
    { value: 'stories', label: 'User Stories' },
    { value: 'mockups', label: 'Mockups' },
    { value: 'export', label: 'Export' },
  ];

  const handleChange = (e) => {
    if (onChange) {
      onChange(e.target.value);
    }
  };

  return (
    <div className="stage-filter">
      <label htmlFor="stage-filter" className="stage-filter__label">
        Filter by stage:
      </label>
      <select
        id="stage-filter"
        className="stage-filter__select"
        value={value}
        onChange={handleChange}
      >
        {stages.map((stage) => (
          <option key={stage.value} value={stage.value}>
            {stage.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default StageFilter;
