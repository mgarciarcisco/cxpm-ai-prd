import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { EmptyState } from '../common/EmptyState';
import { StageActions } from '../stage/StageActions';
import GenerateFromStoriesModal from '../mockups/GenerateFromStoriesModal';
import DescribeUIModal from '../mockups/DescribeUIModal';
import { MockupCard } from '../mockups/MockupCard';
import { MockupFilters } from '../mockups/MockupFilters';
import './StageContent.css';
import './MockupsStage.css';

/**
 * Mockups stage content component.
 * Shows empty state when no mockups exist, with options to generate from stories or describe manually.
 * Shows mockup grid with filters when mockups exist.
 */
function MockupsStage({ project, onProjectUpdate }) {
  // Modal state
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showDescribeModal, setShowDescribeModal] = useState(false);

  // Mockups state
  const [mockups, setMockups] = useState([]);
  const [loadingMockups, setLoadingMockups] = useState(false);

  // Filters state
  const [filters, setFilters] = useState({ device: 'all', style: 'all', status: 'all', search: '' });

  // Check if there are any mockups (mockups_status !== 'empty')
  const hasMockups = project?.mockups_status && project.mockups_status !== 'empty';

  // Check if user stories are refined (ready for mockup generation)
  const storiesRefined = project?.stories_status === 'refined';

  // Mockups icon SVG
  const mockupsIcon = (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="8" width="32" height="32" rx="4" stroke="currentColor" strokeWidth="2"/>
      <circle cx="18" cy="18" r="4" stroke="currentColor" strokeWidth="2"/>
      <path d="M8 32L18 24L26 30L40 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  // Load mockups from API
  const loadMockups = useCallback(async () => {
    if (!project?.id) return;
    try {
      setLoadingMockups(true);
      // TODO: Replace with actual API call when mockups API is implemented
      // const response = await listMockups(project.id, { limit: 100 });
      // setMockups(response.items || []);

      // For now, use mock data to demonstrate the grid
      // This will be replaced with actual API data once the backend is ready
      const mockMockups = [
        {
          id: '1',
          mockup_id: 'MK-001',
          title: 'Login Page - Desktop View',
          description: 'Main login page with email and password fields, social login options',
          device: 'desktop',
          style: 'modern',
          thumbnail_url: null,
          status: 'ready',
          created_at: new Date().toISOString(),
        },
        {
          id: '2',
          mockup_id: 'MK-002',
          title: 'Dashboard Overview',
          description: 'Main dashboard showing key metrics and recent activity',
          device: 'desktop',
          style: 'minimal',
          thumbnail_url: null,
          status: 'draft',
          created_at: new Date().toISOString(),
        },
        {
          id: '3',
          mockup_id: 'MK-003',
          title: 'User Profile - Mobile',
          description: 'User profile page optimized for mobile devices',
          device: 'mobile',
          style: 'modern',
          thumbnail_url: null,
          status: 'draft',
          created_at: new Date().toISOString(),
        },
        {
          id: '4',
          mockup_id: 'MK-004',
          title: 'Settings Page - Tablet',
          description: 'App settings and preferences layout for tablet',
          device: 'tablet',
          style: 'playful',
          thumbnail_url: null,
          status: 'ready',
          created_at: new Date().toISOString(),
        },
      ];
      setMockups(mockMockups);
    } catch (err) {
      console.error('Failed to load mockups:', err);
    } finally {
      setLoadingMockups(false);
    }
  }, [project?.id]);

  // Load mockups when component mounts or mockups exist
  useEffect(() => {
    if (hasMockups && project?.id) {
      loadMockups();
    }
  }, [hasMockups, project?.id, loadMockups]);

  // Calculate summary with mockup count and device breakdown
  const summary = useMemo(() => {
    if (mockups.length === 0) return null;

    const totalCount = mockups.length;

    // Count devices
    const deviceCounts = { desktop: 0, tablet: 0, mobile: 0 };
    mockups.forEach((mockup) => {
      const device = (mockup.device || 'desktop').toLowerCase();
      if (deviceCounts[device] !== undefined) {
        deviceCounts[device]++;
      }
    });

    // Build device string
    const deviceParts = [];
    if (deviceCounts.desktop > 0) deviceParts.push(`${deviceCounts.desktop} desktop`);
    if (deviceCounts.tablet > 0) deviceParts.push(`${deviceCounts.tablet} tablet`);
    if (deviceCounts.mobile > 0) deviceParts.push(`${deviceCounts.mobile} mobile`);
    const deviceStr = deviceParts.join(', ');

    const mockupWord = totalCount === 1 ? 'mockup' : 'mockups';
    return deviceStr ? `${totalCount} ${mockupWord} (${deviceStr})` : `${totalCount} ${mockupWord}`;
  }, [mockups]);

  // Filtered mockups based on current filters
  const filteredMockups = useMemo(() => {
    return mockups.filter((mockup) => {
      // Device filter
      if (filters.device !== 'all') {
        const mockupDevice = (mockup.device || 'desktop').toLowerCase();
        if (mockupDevice !== filters.device.toLowerCase()) {
          return false;
        }
      }

      // Style filter
      if (filters.style !== 'all') {
        const mockupStyle = (mockup.style || 'modern').toLowerCase();
        if (mockupStyle !== filters.style.toLowerCase()) {
          return false;
        }
      }

      // Status filter
      if (filters.status !== 'all') {
        const mockupStatus = (mockup.status || 'draft').toLowerCase();
        if (mockupStatus !== filters.status.toLowerCase()) {
          return false;
        }
      }

      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesId = mockup.mockup_id?.toLowerCase().includes(searchLower);
        const matchesTitle = mockup.title?.toLowerCase().includes(searchLower);
        const matchesDescription = mockup.description?.toLowerCase().includes(searchLower);
        if (!matchesId && !matchesTitle && !matchesDescription) {
          return false;
        }
      }

      return true;
    });
  }, [mockups, filters]);

  // Handle Generate from Stories button click
  const handleGenerateFromStories = () => {
    setShowGenerateModal(true);
  };

  // Handle mockup generation from modal
  const handleGenerate = (options) => {
    console.log('Generate mockups with options:', options);
    // TODO: Implement actual mockup generation API call
    // This will call the mockup generation API with selected stories, style, and devices

    // Notify parent to refresh project data after generation
    if (onProjectUpdate) {
      onProjectUpdate();
    }
  };

  // Handle Describe Manually button click
  const handleDescribeManually = () => {
    setShowDescribeModal(true);
  };

  // Handle mockup generation from description modal
  const handleDescribeGenerate = (options) => {
    console.log('Generate mockup from description:', options);
    // TODO: Implement actual mockup generation API call
    // This will call the mockup generation API with title, description, style, and devices

    // Notify parent to refresh project data after generation
    if (onProjectUpdate) {
      onProjectUpdate();
    }
  };

  // Handle view mockup
  const handleViewMockup = (mockup) => {
    console.log('View mockup:', mockup);
    // TODO: Implement mockup viewer modal
  };

  // Handle delete mockup
  const handleDeleteMockup = async (mockupId) => {
    try {
      // TODO: Implement actual API delete call
      // await deleteMockup(mockupId);

      // For now, just remove from local state
      setMockups((prev) => prev.filter((m) => m.id !== mockupId));

      // Refresh project to update status if needed
      if (onProjectUpdate) {
        onProjectUpdate();
      }
    } catch (err) {
      console.error('Failed to delete mockup:', err);
      throw err;
    }
  };

  // Empty state - no mockups yet
  if (!hasMockups) {
    return (
      <>
        <div className="stage-content stage-content--mockups">
          <EmptyState
            icon={mockupsIcon}
            title="No mockups yet"
            description="Generate UI mockups from your user stories or describe what you need."
            actions={[
              <button
                key="generate"
                onClick={handleGenerateFromStories}
                disabled={!storiesRefined}
                title={!storiesRefined ? 'Refine user stories first' : undefined}
              >
                Generate from Stories
              </button>,
              <button
                key="describe"
                className="secondary"
                onClick={handleDescribeManually}
              >
                Describe Manually
              </button>
            ]}
          />
        </div>

        {/* Generate from Stories Modal */}
        {showGenerateModal && (
          <GenerateFromStoriesModal
            projectId={project?.id}
            onClose={() => setShowGenerateModal(false)}
            onGenerate={handleGenerate}
          />
        )}

        {/* Describe UI Modal */}
        {showDescribeModal && (
          <DescribeUIModal
            projectId={project?.id}
            onClose={() => setShowDescribeModal(false)}
            onGenerate={handleDescribeGenerate}
          />
        )}
      </>
    );
  }

  // Loading state
  if (loadingMockups) {
    return (
      <div className="stage-content stage-content--mockups">
        <div className="mockups-stage__loading">
          <div className="mockups-stage__spinner" />
          <span className="mockups-stage__loading-text">Loading mockups...</span>
        </div>
      </div>
    );
  }

  // Mockups grid view
  return (
    <>
      <div className="stage-content stage-content--mockups">
        <div className="mockups-stage__header">
          <h2 className="mockups-stage__title">Mockups</h2>
          {summary && (
            <span className="mockups-stage__summary">{summary}</span>
          )}
        </div>

        {/* Mockup Filters */}
        <MockupFilters
          filters={filters}
          onChange={setFilters}
          filteredCount={filteredMockups.length}
          totalCount={mockups.length}
        />

        {/* Mockups Grid */}
        <div className="mockups-stage__grid">
          {filteredMockups.length === 0 ? (
            <div className="mockups-stage__no-results">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <p>No mockups match your filters</p>
              <button
                type="button"
                className="mockups-stage__clear-filters-btn"
                onClick={() => setFilters({ device: 'all', style: 'all', status: 'all', search: '' })}
              >
                Clear Filters
              </button>
            </div>
          ) : (
            filteredMockups.map((mockup) => (
              <MockupCard
                key={mockup.id}
                mockup={mockup}
                onView={handleViewMockup}
                onDelete={handleDeleteMockup}
              />
            ))
          )}
        </div>
      </div>

      {/* Stage Actions */}
      <StageActions
        primaryAction={{
          label: 'Generate from Stories',
          onClick: handleGenerateFromStories,
          disabled: !storiesRefined,
        }}
        secondaryAction={{
          label: 'Describe Manually',
          onClick: handleDescribeManually,
        }}
      />

      {/* Generate from Stories Modal (for generating more mockups) */}
      {showGenerateModal && (
        <GenerateFromStoriesModal
          projectId={project?.id}
          onClose={() => setShowGenerateModal(false)}
          onGenerate={handleGenerate}
        />
      )}

      {/* Describe UI Modal */}
      {showDescribeModal && (
        <DescribeUIModal
          projectId={project?.id}
          onClose={() => setShowDescribeModal(false)}
          onGenerate={handleDescribeGenerate}
        />
      )}
    </>
  );
}

export default MockupsStage;
