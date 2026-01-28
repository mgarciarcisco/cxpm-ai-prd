import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { EmptyState } from '../common/EmptyState';
import { StageActions } from '../stage/StageActions';
import GenerateStoriesModal from '../stories/GenerateStoriesModal';
import { StoryCard } from '../stories/StoryCard';
import { StoryEditModal } from '../stories/StoryEditModal';
import { StoryFilters } from '../stories/StoryFilters';
import { listStories, updateStory, deleteStory, createStory, patch, reorderStories } from '../../services/api';
import './StageContent.css';
import './UserStoriesStage.css';

/**
 * User Stories stage content component.
 * Shows empty state when no user stories exist, with options to generate from PRD or add manually.
 * Shows warning if PRD is not yet ready.
 */
function UserStoriesStage({ project, onProjectUpdate }) {
  // Modal state
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  // Stories state
  const [stories, setStories] = useState([]);
  const [loadingStories, setLoadingStories] = useState(false);

  // Edit/Create modal state
  const [editingStory, setEditingStory] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSavingStory, setIsSavingStory] = useState(false);

  // Mark as refined state
  const [markingAsRefined, setMarkingAsRefined] = useState(false);

  // Drag and drop state
  const [draggedStoryId, setDraggedStoryId] = useState(null);
  const [dragOverStoryId, setDragOverStoryId] = useState(null);
  const dragNodeRef = useRef(null);

  // Filters state
  const [filters, setFilters] = useState({ size: 'all', priority: 'all', search: '' });

  // Filtered stories based on current filters
  const filteredStories = useMemo(() => {
    return stories.filter((story) => {
      // Size filter
      if (filters.size !== 'all') {
        const storySize = (story.size || 'M').toUpperCase();
        if (storySize !== filters.size.toUpperCase()) {
          return false;
        }
      }

      // Priority filter
      if (filters.priority !== 'all') {
        const storyPriority = (story.priority || '').toLowerCase();
        if (storyPriority !== filters.priority.toLowerCase()) {
          return false;
        }
      }

      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesId = story.story_id?.toLowerCase().includes(searchLower);
        const matchesTitle = story.title?.toLowerCase().includes(searchLower);
        const matchesDescription = story.description?.toLowerCase().includes(searchLower);
        const matchesLabels = story.labels?.some((label) =>
          label.toLowerCase().includes(searchLower)
        );
        if (!matchesId && !matchesTitle && !matchesDescription && !matchesLabels) {
          return false;
        }
      }

      return true;
    });
  }, [stories, filters]);

  // Check if there are any user stories (stories_status !== 'empty')
  const hasStories = project?.stories_status && project.stories_status !== 'empty';

  // Check if PRD is complete (ready)
  const prdComplete = project?.prd_status === 'ready';

  // Check if stories are already refined
  const isRefined = project?.stories_status === 'refined';

  // User stories icon SVG
  const storiesIcon = (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="10" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="2"/>
      <rect x="26" y="10" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="2"/>
      <rect x="8" y="26" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="2"/>
      <rect x="26" y="26" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="2"/>
    </svg>
  );

  // Warning icon for incomplete PRD
  const warningIcon = (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 5.5V8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="8" cy="11" r="0.75" fill="currentColor"/>
      <path d="M6.86 2.573L1.215 12.427C.77 13.2 1.322 14.167 2.216 14.167h11.568c.894 0 1.446-.966 1.001-1.74L9.14 2.573c-.44-.765-1.54-.765-1.98 0z" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );

  // Handle Generate from PRD button click
  const handleGenerateFromPRD = () => {
    setShowGenerateModal(true);
  };

  // Load stories from API
  const loadStories = useCallback(async () => {
    if (!project?.id) return;
    try {
      setLoadingStories(true);
      const response = await listStories(project.id, { limit: 100 });
      setStories(response.items || []);
    } catch (err) {
      console.error('Failed to load stories:', err);
    } finally {
      setLoadingStories(false);
    }
  }, [project?.id]);

  // Load stories when component mounts or stories exist
  useEffect(() => {
    if (hasStories && project?.id) {
      loadStories();
    }
  }, [hasStories, project?.id, loadStories]);

  // Handle story generation from modal
  const handleGenerate = (options) => {
    console.log('Generate stories with options:', options);
    // TODO: Call API to generate stories (future task)
    // After generation, reload stories and refresh project
    loadStories();
    if (onProjectUpdate) {
      onProjectUpdate();
    }
  };

  // Handle Add Manually button click - opens create modal
  const handleAddManually = () => {
    setShowCreateModal(true);
  };

  // Handle edit story
  const handleEditStory = (story) => {
    setEditingStory(story);
  };

  // Handle save story changes
  const handleSaveStory = async (storyId, updatedData) => {
    try {
      setIsSavingStory(true);
      await updateStory(storyId, updatedData);
      // Reload stories to get updated data
      await loadStories();
      setEditingStory(null);
    } catch (err) {
      console.error('Failed to save story:', err);
    } finally {
      setIsSavingStory(false);
    }
  };

  // Handle create new story
  const handleCreateStory = async (storyData) => {
    if (!project?.id) return;
    try {
      setIsSavingStory(true);
      await createStory(project.id, storyData);
      // Reload stories to get updated data
      await loadStories();
      setShowCreateModal(false);
      // Refresh project to update status if needed
      if (onProjectUpdate) {
        onProjectUpdate();
      }
    } catch (err) {
      console.error('Failed to create story:', err);
    } finally {
      setIsSavingStory(false);
    }
  };

  // Handle delete story
  const handleDeleteStory = async (storyId) => {
    try {
      await deleteStory(storyId);
      // Reload stories to reflect deletion
      await loadStories();
      // Refresh project to update status if needed
      if (onProjectUpdate) {
        onProjectUpdate();
      }
    } catch (err) {
      console.error('Failed to delete story:', err);
      throw err; // Re-throw to keep modal open on error
    }
  };

  // Handle Mark as Refined - updates stories_status to 'refined'
  const handleMarkAsRefined = async () => {
    if (!project?.id) return;

    try {
      setMarkingAsRefined(true);
      await patch(`/api/projects/${project.id}/stages/stories`, { status: 'refined' });
      // Notify parent to refresh project data
      if (onProjectUpdate) {
        onProjectUpdate();
      }
    } catch (err) {
      console.error('Failed to mark as refined:', err);
    } finally {
      setMarkingAsRefined(false);
    }
  };

  // Handle drag start
  const handleDragStart = (e, storyId) => {
    setDraggedStoryId(storyId);
    dragNodeRef.current = e.target;

    // Set drag data
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', storyId);

    // Add dragging class after a short delay for visual feedback
    setTimeout(() => {
      if (dragNodeRef.current) {
        dragNodeRef.current.classList.add('story-card--dragging');
      }
    }, 0);
  };

  // Handle drag end
  const handleDragEnd = () => {
    setDraggedStoryId(null);
    setDragOverStoryId(null);

    if (dragNodeRef.current) {
      dragNodeRef.current.classList.remove('story-card--dragging');
    }
    dragNodeRef.current = null;
  };

  // Handle drag over
  const handleDragOver = (e, storyId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (storyId !== draggedStoryId) {
      setDragOverStoryId(storyId);
    }
  };

  // Handle drag leave
  const handleDragLeave = (e) => {
    // Only clear dragOverStoryId if leaving the actual card element
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverStoryId(null);
    }
  };

  // Handle drop - reorder stories and persist to database
  const handleDrop = async (e, targetStoryId) => {
    e.preventDefault();

    if (!draggedStoryId || draggedStoryId === targetStoryId) {
      handleDragEnd();
      return;
    }

    // Find indices
    const draggedIndex = stories.findIndex(s => s.id === draggedStoryId);
    const targetIndex = stories.findIndex(s => s.id === targetStoryId);

    if (draggedIndex === -1 || targetIndex === -1) {
      handleDragEnd();
      return;
    }

    // Create new order
    const newStories = [...stories];
    const [draggedStory] = newStories.splice(draggedIndex, 1);
    newStories.splice(targetIndex, 0, draggedStory);

    // Optimistically update UI
    setStories(newStories);
    handleDragEnd();

    // Persist to database
    try {
      const storyIds = newStories.map(s => s.id);
      await reorderStories(project.id, storyIds);
    } catch (err) {
      console.error('Failed to persist story order:', err);
      // Reload stories on error to restore original order
      loadStories();
    }
  };

  // Empty state - no stories yet
  if (!hasStories) {
    return (
      <>
        <div className="stage-content stage-content--stories">
          {/* Warning banner if PRD not complete */}
          {!prdComplete && (
            <div className="stories-stage__warning">
              <span className="stories-stage__warning-icon">{warningIcon}</span>
              <span className="stories-stage__warning-text">
                PRD is not yet ready. Consider completing the PRD before generating user stories.
              </span>
            </div>
          )}

          <EmptyState
            icon={storiesIcon}
            title="No user stories yet"
            description="Generate user stories from your PRD or create them manually."
            actions={[
              <button
                key="generate"
                onClick={handleGenerateFromPRD}
                disabled={!prdComplete}
                title={!prdComplete ? 'Complete PRD first' : undefined}
              >
                Generate from PRD
              </button>,
              <button
                key="manual"
                className="secondary"
                onClick={handleAddManually}
              >
                Add Manually
              </button>
            ]}
          />
        </div>

        {/* Generate Stories Modal */}
        {showGenerateModal && (
          <GenerateStoriesModal
            projectId={project?.id}
            onClose={() => setShowGenerateModal(false)}
            onGenerate={handleGenerate}
          />
        )}

        {/* Story Create Modal */}
        {showCreateModal && (
          <StoryEditModal
            onCreate={handleCreateStory}
            onClose={() => setShowCreateModal(false)}
            isSaving={isSavingStory}
          />
        )}
      </>
    );
  }

  // Loading state
  if (loadingStories) {
    return (
      <div className="stage-content stage-content--stories">
        <div className="stories-stage__loading">
          <div className="stories-stage__spinner" />
          <span className="stories-stage__loading-text">Loading stories...</span>
        </div>
      </div>
    );
  }

  // Stories list view
  return (
    <>
      <div className="stage-content stage-content--stories">
        <div className="stories-stage__header">
          <h2 className="stories-stage__title">
            User Stories ({stories.length})
          </h2>
        </div>

        {/* Story Filters */}
        <StoryFilters
          filters={filters}
          onChange={setFilters}
          filteredCount={filteredStories.length}
          totalCount={stories.length}
        />

        <div className="stories-stage__list">
          {filteredStories.length === 0 ? (
            <div className="stories-stage__no-results">
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
              <p>No stories match your filters</p>
              <button
                type="button"
                className="stories-stage__clear-filters-btn"
                onClick={() => setFilters({ size: 'all', priority: 'all', search: '' })}
              >
                Clear Filters
              </button>
            </div>
          ) : (
            filteredStories.map((story) => (
              <div
                key={story.id}
                className={`stories-stage__card-wrapper ${
                  dragOverStoryId === story.id ? 'stories-stage__card-wrapper--drag-over' : ''
                } ${draggedStoryId === story.id ? 'stories-stage__card-wrapper--dragging' : ''}`}
                draggable
                onDragStart={(e) => handleDragStart(e, story.id)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, story.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, story.id)}
              >
                <StoryCard
                  story={story}
                  onEdit={handleEditStory}
                  onDelete={handleDeleteStory}
                  showDragHandle={true}
                  dragHandleProps={{
                    onMouseDown: (e) => e.stopPropagation(),
                  }}
                />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Stage Actions */}
      <StageActions
        primaryAction={
          isRefined
            ? { label: 'Refined', onClick: () => {}, disabled: true }
            : { label: 'Mark as Refined', onClick: handleMarkAsRefined, loading: markingAsRefined }
        }
        secondaryAction={{
          label: 'Generate More',
          onClick: handleGenerateFromPRD,
          disabled: !prdComplete,
        }}
      />

      {/* Story Edit Modal */}
      {editingStory && (
        <StoryEditModal
          story={editingStory}
          onSave={handleSaveStory}
          onClose={() => setEditingStory(null)}
          isSaving={isSavingStory}
        />
      )}

      {/* Story Create Modal */}
      {showCreateModal && (
        <StoryEditModal
          onCreate={handleCreateStory}
          onClose={() => setShowCreateModal(false)}
          isSaving={isSavingStory}
        />
      )}

      {/* Generate Stories Modal (for Generate More) */}
      {showGenerateModal && (
        <GenerateStoriesModal
          projectId={project?.id}
          onClose={() => setShowGenerateModal(false)}
          onGenerate={handleGenerate}
        />
      )}
    </>
  );
}

export default UserStoriesStage;
