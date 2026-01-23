import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { get } from '../services/api';
import { CollapsibleSection } from '../components/common/CollapsibleSection';
import { ItemRow } from '../components/common/ItemRow';
import './RequirementsPage.css';

/**
 * Section configuration for display order and labels
 * Matches backend Section enum
 */
const SECTIONS = [
  { key: 'problems', label: 'Problems' },
  { key: 'user_goals', label: 'User Goals' },
  { key: 'functional_requirements', label: 'Functional Requirements' },
  { key: 'data_needs', label: 'Data Needs' },
  { key: 'constraints', label: 'Constraints' },
  { key: 'non_goals', label: 'Non-Goals' },
  { key: 'risks_assumptions', label: 'Risks & Assumptions' },
  { key: 'open_questions', label: 'Open Questions' },
  { key: 'action_items', label: 'Action Items' },
];

function RequirementsPage() {
  const { id } = useParams();
  const [requirements, setRequirements] = useState(null);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [projectData, requirementsData] = await Promise.all([
        get(`/api/projects/${id}`),
        get(`/api/projects/${id}/requirements`)
      ]);
      setProject(projectData);
      setRequirements(requirementsData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle edit callback from ItemRow - updates local state with the updated item
   * @param {Object} updatedItem - The updated requirement from the API
   */
  const handleEditItem = (updatedItem) => {
    setRequirements((prev) => {
      if (!prev) return prev;
      const newRequirements = { ...prev };
      // Find and update the item in the correct section
      Object.keys(newRequirements).forEach((sectionKey) => {
        newRequirements[sectionKey] = newRequirements[sectionKey].map((item) =>
          item.id === updatedItem.id ? { ...item, content: updatedItem.content } : item
        );
      });
      return newRequirements;
    });
  };

  /**
   * Handle delete callback from ItemRow - removes the deleted item from local state
   * @param {Object} deletedItem - The deleted requirement
   */
  const handleDeleteItem = (deletedItem) => {
    setRequirements((prev) => {
      if (!prev) return prev;
      const newRequirements = { ...prev };
      // Find and remove the item from the correct section
      Object.keys(newRequirements).forEach((sectionKey) => {
        newRequirements[sectionKey] = newRequirements[sectionKey].filter(
          (item) => item.id !== deletedItem.id
        );
      });
      return newRequirements;
    });
  };

  if (loading) {
    return (
      <main className="main-content">
        <div className="requirements-loading">
          <div className="loading-spinner"></div>
          <p>Loading requirements...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="main-content">
        <div className="requirements-error">
          <p>Error loading requirements: {error}</p>
          <button onClick={fetchData} className="retry-btn">Retry</button>
        </div>
      </main>
    );
  }

  return (
    <main className="main-content">
      <section className="requirements-section">
        <div className="section-header">
          <h2>{project?.name || 'Project'} - Requirements</h2>
          <Link to={`/app/projects/${id}`} className="back-link">Back to Project</Link>
        </div>

        <div className="requirements-content">
          {SECTIONS.map((section) => {
            const sectionItems = requirements?.[section.key] || [];
            return (
              <CollapsibleSection
                key={section.key}
                title={section.label}
                itemCount={sectionItems.length}
                defaultExpanded={true}
              >
                {sectionItems.length > 0 ? (
                  <div className="requirements-items">
                    {sectionItems.map((item) => (
                      <div key={item.id} className="requirements-item-wrapper">
                        <ItemRow
                          item={item}
                          onEdit={handleEditItem}
                          onDelete={handleDeleteItem}
                          apiEndpoint="requirements"
                          draggable={false}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="requirements-empty">No requirements in this section</p>
                )}
              </CollapsibleSection>
            );
          })}
        </div>
      </section>
    </main>
  );
}

export default RequirementsPage;
