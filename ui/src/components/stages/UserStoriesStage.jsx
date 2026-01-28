import React, { useState, useEffect, useCallback } from 'react';
import { EmptyState } from '../common/EmptyState';
import { StageActions } from '../stage/StageActions';
import GenerateStoriesModal from '../stories/GenerateStoriesModal';
import { StoryCard } from '../stories/StoryCard';
import { StoryEditModal } from '../stories/StoryEditModal';
import { listStories, updateStory, deleteStory, patch } from '../../services/api';
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

  // Edit modal state
  const [editingStory, setEditingStory] = useState(null);
  const [isSavingStory, setIsSavingStory] = useState(false);

  // Mark as refined state
  const [markingAsRefined, setMarkingAsRefined] = useState(false);

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

  // Handle Add Manually button click
  const handleAddManually = () => {
    console.log('Add story manually');
    // TODO: Open StoryEditorModal in create mode (P3-021)
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

        <div className="stories-stage__list">
          {stories.map((story) => (
            <StoryCard
              key={story.id}
              story={story}
              onEdit={handleEditStory}
              onDelete={handleDeleteStory}
              showDragHandle={false}
            />
          ))}
        </div>
      </div>

      {/* Stage Actions */}
      <StageActions
        primaryAction={
          isRefined
            ? { label: 'Refined', onClick: () => {}, disabled: true }
            : { label: 'Mark as Refined', onClick: handleMarkAsRefined, loading: markingAsRefined }
        }
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
    </>
  );
}

export default UserStoriesStage;
