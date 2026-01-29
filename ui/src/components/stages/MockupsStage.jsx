import React, { useState, useEffect, useCallback, useMemo } from 'react';
import JSZip from 'jszip';
import { EmptyState } from '../common/EmptyState';
import { StageActions } from '../stage/StageActions';
import { StageLoader } from './StageLoader';
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

  // Download state
  const [isDownloading, setIsDownloading] = useState(false);

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

  // Handle rename mockup
  const handleRenameMockup = async (mockupId, newTitle) => {
    try {
      // TODO: Implement actual API rename call
      // await renameMockup(mockupId, newTitle);

      // For now, just update local state
      setMockups((prev) =>
        prev.map((m) =>
          m.id === mockupId ? { ...m, title: newTitle } : m
        )
      );

      // Refresh project if needed
      if (onProjectUpdate) {
        onProjectUpdate();
      }
    } catch (err) {
      console.error('Failed to rename mockup:', err);
      throw err;
    }
  };

  // Generate a safe filename from mockup title
  const slugifyFilename = (name) => {
    return name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-_]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'mockup';
  };

  // Handle download all mockups as zip
  const handleDownloadAll = async () => {
    if (mockups.length === 0) return;

    setIsDownloading(true);
    try {
      const zip = new JSZip();
      const projectSlug = project?.name ? slugifyFilename(project.name) : 'mockups';

      // Add each mockup to the zip
      for (let i = 0; i < mockups.length; i++) {
        const mockup = mockups[i];
        const filename = `${mockup.mockup_id || `mockup-${i + 1}`}-${slugifyFilename(mockup.title || 'untitled')}.png`;

        // If mockup has a thumbnail_url, fetch and add to zip
        if (mockup.thumbnail_url) {
          try {
            let blob;
            if (mockup.thumbnail_url.startsWith('data:')) {
              // Convert data URL to blob
              const response = await fetch(mockup.thumbnail_url);
              blob = await response.blob();
            } else {
              // Fetch image from URL
              const response = await fetch(mockup.thumbnail_url);
              if (response.ok) {
                blob = await response.blob();
              }
            }
            if (blob) {
              zip.file(filename, blob);
            }
          } catch (err) {
            console.warn(`Failed to fetch mockup ${mockup.mockup_id}:`, err);
          }
        } else {
          // If no image URL, create a placeholder text file with mockup info
          const infoContent = [
            `Mockup ID: ${mockup.mockup_id || 'N/A'}`,
            `Title: ${mockup.title || 'Untitled'}`,
            `Description: ${mockup.description || 'No description'}`,
            `Device: ${mockup.device || 'N/A'}`,
            `Style: ${mockup.style || 'N/A'}`,
            `Status: ${mockup.status || 'N/A'}`,
            `Created: ${mockup.created_at || 'N/A'}`,
          ].join('\n');
          zip.file(filename.replace('.png', '.txt'), infoContent);
        }
      }

      // Check if any files were added
      const files = Object.keys(zip.files);
      if (files.length === 0) {
        console.warn('No mockups available to download');
        return;
      }

      // Generate and download ZIP
      const blob = await zip.generateAsync({ type: 'blob' });
      const date = new Date().toISOString().split('T')[0];
      const zipFilename = `${projectSlug}-mockups-${date}.zip`;

      // Trigger download
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = zipFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download mockups:', err);
    } finally {
      setIsDownloading(false);
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
        <StageLoader message="Loading mockups..." stage="mockups" />
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
                onRename={handleRenameMockup}
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
        tertiaryAction={{
          label: isDownloading ? 'Downloading...' : 'Download All',
          onClick: handleDownloadAll,
          disabled: isDownloading || mockups.length === 0,
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
