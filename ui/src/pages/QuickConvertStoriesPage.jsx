import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { StoryEditModal } from '../components/stories/StoryEditModal';
import SaveToProjectModal from '../components/quick-convert/SaveToProjectModal';
import { STORAGE_KEYS, saveToSession, loadFromSession, clearSession } from '../utils/sessionStorage';
import './QuickConvertStoriesPage.css';

// Input source options
const INPUT_SOURCES = {
  prd: { id: 'prd', label: 'PRD', placeholder: 'Paste your Product Requirements Document here...' },
  description: { id: 'description', label: 'Feature Description', placeholder: 'Describe the feature or functionality you want to create user stories for...' },
};

// Story format options
const STORY_FORMATS = {
  standard: { id: 'standard', label: 'Standard', description: 'As a [user], I want [goal] so that [benefit]' },
  gherkin: { id: 'gherkin', label: 'Gherkin', description: 'Given/When/Then format for BDD' },
  jtbd: { id: 'jtbd', label: 'Jobs to be Done', description: 'When [situation], I want to [motivation], so I can [outcome]' },
};

// Include options
const INCLUDE_OPTIONS = {
  acceptanceCriteria: { id: 'acceptanceCriteria', label: 'Acceptance Criteria', description: 'Detailed conditions for story completion' },
  size: { id: 'size', label: 'Size Estimates', description: 'T-shirt sizing (XS, S, M, L, XL)' },
  priority: { id: 'priority', label: 'Priority', description: 'P1, P2, P3 priority levels' },
};

// Simulated story templates based on format
const generateSimulatedStories = (inputText, format, includeOptions) => {
  const baseStories = [
    {
      title: 'User Authentication',
      description_standard: 'As a user, I want to securely log in to the application so that I can access my personalized content and settings.',
      description_gherkin: 'Given I am on the login page, When I enter valid credentials and click submit, Then I should be redirected to my dashboard.',
      description_jtbd: 'When I need to access my account, I want to authenticate quickly, so I can get to my tasks without delay.',
      acceptance_criteria: [
        'User can log in with email and password',
        'System validates credentials against stored data',
        'Invalid credentials show appropriate error message',
        'Session persists across browser refreshes',
      ],
      size: 'm',
      priority: 'high',
      labels: ['authentication', 'security'],
    },
    {
      title: 'Dashboard Overview',
      description_standard: 'As a user, I want to see a dashboard with key metrics so that I can quickly understand my current status.',
      description_gherkin: 'Given I am logged in, When I navigate to the dashboard, Then I should see my key metrics displayed in cards.',
      description_jtbd: 'When I first open the app, I want to see my most important information, so I can make informed decisions quickly.',
      acceptance_criteria: [
        'Dashboard loads within 2 seconds',
        'Key metrics are displayed prominently',
        'Data refreshes when user navigates to dashboard',
        'Loading state shown while data is fetching',
      ],
      size: 'l',
      priority: 'high',
      labels: ['dashboard', 'ui'],
    },
    {
      title: 'Search Functionality',
      description_standard: 'As a user, I want to search for items using keywords so that I can quickly find what I need.',
      description_gherkin: 'Given I am on any page with a search bar, When I type a search query and press enter, Then I should see relevant results.',
      description_jtbd: 'When I am looking for specific content, I want to search by keywords, so I can find it without browsing manually.',
      acceptance_criteria: [
        'Search bar is accessible from all pages',
        'Results appear as user types (debounced)',
        'No results state is handled gracefully',
        'Search history is saved for convenience',
      ],
      size: 'm',
      priority: 'medium',
      labels: ['search', 'ux'],
    },
    {
      title: 'Export Data',
      description_standard: 'As a user, I want to export my data in multiple formats so that I can use it in other applications.',
      description_gherkin: 'Given I have data I want to export, When I select export and choose a format, Then a file should download.',
      description_jtbd: 'When I need to share data with colleagues, I want to export in common formats, so I can collaborate effectively.',
      acceptance_criteria: [
        'Support CSV, JSON, and PDF export formats',
        'Export includes all selected data',
        'Large exports show progress indicator',
        'File name includes date and type',
      ],
      size: 's',
      priority: 'medium',
      labels: ['export', 'data'],
    },
    {
      title: 'Notification Preferences',
      description_standard: 'As a user, I want to customize my notification settings so that I only receive alerts that matter to me.',
      description_gherkin: 'Given I am in settings, When I toggle notification preferences, Then my choices should be saved and applied.',
      description_jtbd: 'When notifications become overwhelming, I want to control which ones I receive, so I can focus on what matters.',
      acceptance_criteria: [
        'Users can toggle email notifications on/off',
        'Users can choose notification frequency',
        'Changes are saved immediately',
        'Confirmation shown after saving preferences',
      ],
      size: 's',
      priority: 'low',
      labels: ['notifications', 'settings'],
    },
  ];

  return baseStories.map((story, index) => {
    let description;
    switch (format) {
      case 'gherkin':
        description = story.description_gherkin;
        break;
      case 'jtbd':
        description = story.description_jtbd;
        break;
      default:
        description = story.description_standard;
    }

    return {
      id: `temp-${Date.now()}-${index}`,
      story_id: `US-${String(index + 1).padStart(3, '0')}`,
      title: story.title,
      description,
      acceptance_criteria: includeOptions.acceptanceCriteria ? story.acceptance_criteria : [],
      size: includeOptions.size ? story.size : null,
      priority: includeOptions.priority ? story.priority : null,
      labels: story.labels,
      status: 'draft',
      format: format === 'jtbd' ? 'job_story' : 'classic',
      selected: true,
    };
  });
};

/**
 * Quick Convert Stories page - input UI for generating user stories.
 * Allows users to paste a PRD or feature description, then generate user stories.
 */
function QuickConvertStoriesPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [inputSource, setInputSource] = useState('prd');
  const [fromPreviousStep, setFromPreviousStep] = useState(false);

  // Pre-fill content if navigated from PRD generation
  useEffect(() => {
    if (location.state?.prdText) {
      setContent(location.state.prdText);
      setInputSource('prd');
      setFromPreviousStep(true);
    }
  }, [location.state]);
  const [storyFormat, setStoryFormat] = useState('standard');
  const [includeOptions, setIncludeOptions] = useState({
    acceptanceCriteria: true,
    size: false,
    priority: false,
  });
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState(null);
  const [fileError, setFileError] = useState(null);
  const fileInputRef = useRef(null);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState(null);
  const [generatedStories, setGeneratedStories] = useState(null);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [totalStories, setTotalStories] = useState(0);

  // Edit modal state
  const [editingStory, setEditingStory] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Save to project modal state
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Session storage state
  const [restoredFromSession, setRestoredFromSession] = useState(false);

  // Restore data from session storage on mount (only if not from navigation state)
  useEffect(() => {
    if (location.state?.prdText) return; // Don't restore if coming from PRD page

    const stored = loadFromSession(STORAGE_KEYS.STORIES);
    if (stored?.data?.generatedStories) {
      setGeneratedStories(stored.data.generatedStories);
      setStoryFormat(stored.data.storyFormat || 'standard');
      setIncludeOptions(stored.data.includeOptions || { acceptanceCriteria: true, size: false, priority: false });
      setRestoredFromSession(true);
    }
  }, [location.state]);

  // Save to session storage when generated stories change
  useEffect(() => {
    if (generatedStories) {
      saveToSession(STORAGE_KEYS.STORIES, {
        generatedStories,
        storyFormat,
        includeOptions,
      });
    }
  }, [generatedStories, storyFormat, includeOptions]);

  const hasContent = content.trim().length > 0;

  // Supported file types
  const ACCEPTED_FILE_TYPES = ['.txt', '.md'];
  const ACCEPTED_MIME_TYPES = ['text/plain', 'text/markdown'];

  const isValidFileType = (file) => {
    const extension = '.' + file.name.split('.').pop().toLowerCase();
    return ACCEPTED_FILE_TYPES.includes(extension) || ACCEPTED_MIME_TYPES.includes(file.type);
  };

  const handleFileRead = (file) => {
    if (!isValidFileType(file)) {
      setFileError('Invalid file type. Please upload a .txt or .md file.');
      return;
    }

    setFileError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      setContent(e.target.result);
      setFileName(file.name);
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileRead(file);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileRead(file);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleClearFile = () => {
    setFileName(null);
    setContent('');
    setFileError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleIncludeOptionChange = (optionId) => {
    setIncludeOptions((prev) => ({
      ...prev,
      [optionId]: !prev[optionId],
    }));
  };

  // Simulate story generation with progress
  const simulateGeneration = useCallback(async () => {
    const stories = generateSimulatedStories(content, storyFormat, includeOptions);
    const total = stories.length;
    setTotalStories(total);
    setGenerationProgress(0);

    const result = [];

    for (let i = 0; i < stories.length; i++) {
      // Simulate delay per story (200-400ms)
      await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 200));
      result.push(stories[i]);
      setGenerationProgress(i + 1);
    }

    return result;
  }, [content, storyFormat, includeOptions]);

  const handleGenerate = async () => {
    if (!hasContent) return;

    setIsGenerating(true);
    setGenerationError(null);
    setGeneratedStories(null);
    setGenerationProgress(0);

    try {
      const stories = await simulateGeneration();
      setGeneratedStories(stories);
    } catch (error) {
      setGenerationError(error.message || 'Generation failed. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRetry = () => {
    handleGenerate();
  };

  const handleStartOver = () => {
    setGeneratedStories(null);
    setContent('');
    setFileName(null);
    setGenerationError(null);
    setGenerationProgress(0);
    setRestoredFromSession(false);
    clearSession(STORAGE_KEYS.STORIES);
  };

  // Toggle story selection
  const handleToggleSelection = (storyId) => {
    setGeneratedStories(prev =>
      prev.map(story =>
        story.id === storyId
          ? { ...story, selected: !story.selected }
          : story
      )
    );
  };

  // Select all / deselect all
  const handleSelectAll = () => {
    const allSelected = generatedStories?.every(s => s.selected);
    setGeneratedStories(prev =>
      prev.map(story => ({ ...story, selected: !allSelected }))
    );
  };

  // Open edit modal
  const handleEditStory = (story) => {
    setEditingStory(story);
  };

  // Save edited story
  const handleSaveStory = (storyId, updatedData) => {
    setIsSaving(true);
    // Simulate save delay
    setTimeout(() => {
      setGeneratedStories(prev =>
        prev.map(story =>
          story.id === storyId
            ? { ...story, ...updatedData }
            : story
        )
      );
      setEditingStory(null);
      setIsSaving(false);
    }, 300);
  };

  // Delete story
  const handleDeleteStory = (storyId) => {
    setGeneratedStories(prev => prev.filter(story => story.id !== storyId));
  };

  // Card drag and drop handlers for reordering
  const handleCardDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Add a slight delay to show the drag visual
    e.target.style.opacity = '0.5';
  };

  const handleCardDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleCardDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleCardDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleCardDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    setGeneratedStories(prev => {
      const newStories = [...prev];
      const [draggedItem] = newStories.splice(draggedIndex, 1);
      newStories.splice(dropIndex, 0, draggedItem);
      // Re-assign story_ids based on new order
      return newStories.map((story, idx) => ({
        ...story,
        story_id: `US-${String(idx + 1).padStart(3, '0')}`,
      }));
    });

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Action handlers
  const handleSaveToProject = () => {
    setShowSaveModal(true);
  };

  const handleGenerateMockups = () => {
    // Get selected stories and navigate to mockups page
    const selectedStories = generatedStories?.filter(s => s.selected) || [];
    if (selectedStories.length === 0) {
      alert('Please select at least one story to generate mockups.');
      return;
    }
    // Navigate to mockups page with stories data
    navigate('/quick-convert/mockups', {
      state: {
        stories: selectedStories,
        source: 'stories-generation',
      },
    });
  };

  const handleDownload = () => {
    const selectedStories = generatedStories?.filter(s => s.selected) || [];
    if (selectedStories.length === 0) {
      alert('Please select at least one story to download.');
      return;
    }

    // Format stories for download
    const downloadData = selectedStories.map(story => ({
      id: story.story_id,
      title: story.title,
      description: story.description,
      acceptance_criteria: story.acceptance_criteria || [],
      size: story.size,
      priority: story.priority,
      labels: story.labels || [],
    }));

    // Create and download JSON file
    const blob = new Blob([JSON.stringify(downloadData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `user-stories-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Get selected count
  const selectedCount = generatedStories?.filter(s => s.selected).length || 0;

  // Size color mapping
  const getSizeClass = (size) => {
    switch (size?.toLowerCase()) {
      case 'xs': return 'qc-stories__size--xs';
      case 's': return 'qc-stories__size--s';
      case 'm': return 'qc-stories__size--m';
      case 'l': return 'qc-stories__size--l';
      case 'xl': return 'qc-stories__size--xl';
      default: return '';
    }
  };

  // Priority color mapping
  const getPriorityClass = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'critical': return 'qc-stories__priority--critical';
      case 'high': return 'qc-stories__priority--high';
      case 'medium': return 'qc-stories__priority--medium';
      case 'low': return 'qc-stories__priority--low';
      default: return '';
    }
  };

  // Render the input form
  const renderInputForm = () => (
    <>
      {/* Input Section */}
      <div className="qc-stories__input-section">
        {/* Input Source Toggle */}
        <div className="qc-stories__toggle-group">
          <span className="qc-stories__toggle-label">Input Source</span>
          <div className="qc-stories__toggle-buttons">
            {Object.values(INPUT_SOURCES).map((source) => (
              <button
                key={source.id}
                type="button"
                className={`qc-stories__toggle-btn ${inputSource === source.id ? 'qc-stories__toggle-btn--active' : ''}`}
                onClick={() => setInputSource(source.id)}
              >
                {source.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="qc-stories__content-area">
          <label htmlFor="stories-content" className="qc-stories__label">
            {INPUT_SOURCES[inputSource].label}
          </label>
          {fromPreviousStep && (
            <div className="qc-stories__chained-indicator">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              <span>Using data from previous step</span>
            </div>
          )}
          <textarea
            id="stories-content"
            className="qc-stories__textarea"
            placeholder={INPUT_SOURCES[inputSource].placeholder}
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              if (fileName) setFileName(null);
              if (fromPreviousStep) setFromPreviousStep(false);
            }}
            rows={12}
          />
        </div>

        <div className="qc-stories__divider">
          <span>or</span>
        </div>

        {/* File Upload Zone */}
        <div
          className={`qc-stories__upload-zone ${dragActive ? 'qc-stories__upload-zone--active' : ''}`}
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={handleUploadClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              handleUploadClick();
            }
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,text/plain,text/markdown"
            onChange={handleFileChange}
            className="qc-stories__file-input"
            aria-label="Upload file"
          />
          <svg
            className="qc-stories__upload-icon"
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span className="qc-stories__upload-text">
            {dragActive ? 'Drop file here' : 'Click or drag file here'}
          </span>
          <span className="qc-stories__upload-hint">
            Supports .txt and .md files
          </span>
        </div>

        {fileError && (
          <div className="qc-stories__error" role="alert">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{fileError}</span>
          </div>
        )}

        {fileName && (
          <div className="qc-stories__file-info">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span className="qc-stories__file-name">{fileName}</span>
            <button
              type="button"
              className="qc-stories__file-clear"
              onClick={(e) => {
                e.stopPropagation();
                handleClearFile();
              }}
              aria-label="Clear file"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Options Section */}
      <div className="qc-stories__options-section">
        {/* Story Format Selection */}
        <div className="qc-stories__toggle-group">
          <span className="qc-stories__toggle-label">Story Format</span>
          <div className="qc-stories__format-options">
            {Object.values(STORY_FORMATS).map((format) => (
              <label key={format.id} className="qc-stories__format-option">
                <input
                  type="radio"
                  name="story-format"
                  value={format.id}
                  checked={storyFormat === format.id}
                  onChange={(e) => setStoryFormat(e.target.value)}
                  className="qc-stories__format-radio"
                />
                <div className="qc-stories__format-content">
                  <span className="qc-stories__format-label">{format.label}</span>
                  <span className="qc-stories__format-description">{format.description}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Include Options */}
        <div className="qc-stories__toggle-group qc-stories__toggle-group--include">
          <span className="qc-stories__toggle-label">Include</span>
          <div className="qc-stories__include-options">
            {Object.values(INCLUDE_OPTIONS).map((option) => (
              <label key={option.id} className="qc-stories__include-option">
                <input
                  type="checkbox"
                  checked={includeOptions[option.id]}
                  onChange={() => handleIncludeOptionChange(option.id)}
                  className="qc-stories__include-checkbox"
                />
                <div className="qc-stories__include-content">
                  <span className="qc-stories__include-label">{option.label}</span>
                  <span className="qc-stories__include-description">{option.description}</span>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div className="qc-stories__actions">
        <button
          type="button"
          className="qc-stories__generate-btn"
          onClick={handleGenerate}
          disabled={!hasContent}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
            <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
            <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
            <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
          </svg>
          Generate Stories
        </button>
      </div>
    </>
  );

  // Render generation progress
  const renderGenerating = () => (
    <div className="qc-stories__generation">
      <div className="qc-stories__generation-header">
        <div className="qc-stories__generation-progress">
          <div className="qc-stories__spinner" />
          <span className="qc-stories__generation-status">
            {totalStories > 0
              ? `Generating... Story ${generationProgress} of ${totalStories}`
              : 'Starting generation...'}
          </span>
        </div>
        <div className="qc-stories__generation-mode">
          {STORY_FORMATS[storyFormat]?.label} format
        </div>
      </div>

      {totalStories > 0 && (
        <div className="qc-stories__progress-bar">
          <div
            className="qc-stories__progress-fill"
            style={{ width: `${(generationProgress / totalStories) * 100}%` }}
          />
        </div>
      )}
    </div>
  );

  // Render error state
  const renderError = () => (
    <div className="qc-stories__error-view">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <h2 className="qc-stories__error-title">Generation Failed</h2>
      <p className="qc-stories__error-text">{generationError}</p>
      <div className="qc-stories__error-actions">
        <button type="button" onClick={handleRetry}>Try Again</button>
        <button type="button" className="secondary" onClick={handleStartOver}>Start Over</button>
      </div>
    </div>
  );

  // Render generated stories
  const renderResults = () => (
    <div className="qc-stories__result">
      {/* Result header */}
      <div className="qc-stories__result-header">
        <div className="qc-stories__result-left">
          <button
            type="button"
            className="qc-stories__start-over-btn"
            onClick={handleStartOver}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            Start Over
          </button>
          {restoredFromSession && (
            <span className="qc-stories__restored-indicator">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              Restored from previous session
            </span>
          )}
        </div>
        <div className="qc-stories__result-stats">
          <span className="qc-stories__result-count">
            {generatedStories?.length} stories generated
          </span>
          <span className="qc-stories__selected-count">
            {selectedCount} selected
          </span>
        </div>
      </div>

      {/* Action bar */}
      <div className="qc-stories__action-bar">
        <div className="qc-stories__action-bar-left">
          <button
            type="button"
            className="qc-stories__select-all-btn"
            onClick={handleSelectAll}
          >
            {generatedStories?.every(s => s.selected) ? 'Deselect All' : 'Select All'}
          </button>
          <span className="qc-stories__reorder-hint">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <polyline points="19 12 12 19 5 12" />
            </svg>
            Drag to reorder
          </span>
        </div>
        <div className="qc-stories__action-bar-right">
          <button
            type="button"
            className="qc-stories__action-btn qc-stories__action-btn--secondary"
            onClick={handleDownload}
            disabled={selectedCount === 0}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download
          </button>
          <button
            type="button"
            className="qc-stories__action-btn qc-stories__action-btn--secondary"
            onClick={handleGenerateMockups}
            disabled={selectedCount === 0}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="9" y1="21" x2="9" y2="9" />
            </svg>
            Generate Mockups
          </button>
          <button
            type="button"
            className="qc-stories__action-btn qc-stories__action-btn--primary"
            onClick={handleSaveToProject}
            disabled={selectedCount === 0}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            Save to Project
          </button>
        </div>
      </div>

      {/* Story cards */}
      <div className="qc-stories__cards">
        {generatedStories?.map((story, index) => (
          <div
            key={story.id}
            className={`qc-stories__card ${story.selected ? 'qc-stories__card--selected' : ''} ${dragOverIndex === index ? 'qc-stories__card--drag-over' : ''}`}
            draggable
            onDragStart={(e) => handleCardDragStart(e, index)}
            onDragEnd={handleCardDragEnd}
            onDragOver={(e) => handleCardDragOver(e, index)}
            onDragLeave={handleCardDragLeave}
            onDrop={(e) => handleCardDrop(e, index)}
          >
            {/* Drag handle */}
            <div className="qc-stories__card-drag-handle" title="Drag to reorder">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="8" y1="6" x2="8" y2="6.01" />
                <line x1="16" y1="6" x2="16" y2="6.01" />
                <line x1="8" y1="12" x2="8" y2="12.01" />
                <line x1="16" y1="12" x2="16" y2="12.01" />
                <line x1="8" y1="18" x2="8" y2="18.01" />
                <line x1="16" y1="18" x2="16" y2="18.01" />
              </svg>
            </div>

            {/* Checkbox */}
            <div className="qc-stories__card-checkbox">
              <input
                type="checkbox"
                checked={story.selected}
                onChange={() => handleToggleSelection(story.id)}
                id={`story-checkbox-${story.id}`}
                className="qc-stories__checkbox"
              />
            </div>

            {/* Card content */}
            <div className="qc-stories__card-content">
              {/* Header */}
              <div className="qc-stories__card-header">
                <span className="qc-stories__card-id">{story.story_id}</span>
                <h3 className="qc-stories__card-title">{story.title}</h3>
                {story.size && (
                  <span className={`qc-stories__size ${getSizeClass(story.size)}`}>
                    {story.size.toUpperCase()}
                  </span>
                )}
                {story.priority && (
                  <span className={`qc-stories__priority ${getPriorityClass(story.priority)}`}>
                    {story.priority.charAt(0).toUpperCase() + story.priority.slice(1)}
                  </span>
                )}
              </div>

              {/* Description */}
              <p className="qc-stories__card-description">{story.description}</p>

              {/* Acceptance Criteria */}
              {story.acceptance_criteria?.length > 0 && (
                <div className="qc-stories__card-criteria">
                  <h4 className="qc-stories__criteria-title">
                    Acceptance Criteria ({story.acceptance_criteria.length})
                  </h4>
                  <ul className="qc-stories__criteria-list">
                    {story.acceptance_criteria.map((criterion, idx) => (
                      <li key={idx} className="qc-stories__criterion">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                          <path d="M13.5 4.5L6 12L2.5 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span>{criterion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Labels */}
              {story.labels?.length > 0 && (
                <div className="qc-stories__card-labels">
                  {story.labels.map((label, idx) => (
                    <span key={idx} className="qc-stories__label-chip">
                      {label}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Card actions */}
            <div className="qc-stories__card-actions">
              <button
                type="button"
                className="qc-stories__card-action-btn"
                onClick={() => handleEditStory(story)}
                aria-label="Edit story"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M11.333 2.00004C11.5081 1.82494 11.7169 1.68605 11.9465 1.59129C12.1761 1.49653 12.4218 1.44775 12.67 1.44775C12.9182 1.44775 13.1639 1.49653 13.3935 1.59129C13.6231 1.68605 13.8319 1.82494 14.007 2.00004C14.1821 2.17513 14.321 2.38394 14.4157 2.61352C14.5105 2.84311 14.5593 3.08882 14.5593 3.33704C14.5593 3.58525 14.5105 3.83096 14.4157 4.06055C14.321 4.29013 14.1821 4.49894 14.007 4.67404L5.00033 13.6807L1.33366 14.6667L2.31966 11.0007L11.333 2.00004Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <button
                type="button"
                className="qc-stories__card-action-btn qc-stories__card-action-btn--delete"
                onClick={() => handleDeleteStory(story.id)}
                aria-label="Delete story"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2 4H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12.6667 4V13.3333C12.6667 14 12 14.6667 11.3333 14.6667H4.66667C4 14.6667 3.33333 14 3.33333 13.3333V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M5.33333 4V2.66667C5.33333 2 6 1.33334 6.66667 1.33334H9.33333C10 1.33334 10.6667 2 10.6667 2.66667V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <main className="main-content">
      <section className="qc-stories">
        {/* Back Link */}
        <Link to="/quick-convert" className="qc-stories__back-link">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to Quick Convert
        </Link>

        {/* Header */}
        <div className="qc-stories__header">
          <div className="qc-stories__icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
              <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
              <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
              <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </div>
          <div className="qc-stories__header-content">
            <h1 className="qc-stories__title">
              {generatedStories ? 'Generated User Stories' : 'Create User Stories'}
            </h1>
            <p className="qc-stories__subtitle">
              {generatedStories
                ? 'Review, edit, and select the stories you want to use.'
                : 'Generate user stories from a PRD or feature description, complete with acceptance criteria.'}
            </p>
          </div>
        </div>

        {/* Conditional Content */}
        {isGenerating && renderGenerating()}
        {generationError && !isGenerating && renderError()}
        {generatedStories && !isGenerating && renderResults()}
        {!generatedStories && !isGenerating && !generationError && renderInputForm()}
      </section>

      {/* Edit Modal */}
      {editingStory && (
        <StoryEditModal
          story={editingStory}
          onSave={handleSaveStory}
          onClose={() => setEditingStory(null)}
          isSaving={isSaving}
        />
      )}

      {/* Save to Project Modal */}
      {showSaveModal && (
        <SaveToProjectModal
          onClose={() => setShowSaveModal(false)}
          dataType="stories"
          data={generatedStories?.filter(s => s.selected) || []}
        />
      )}
    </main>
  );
}

export default QuickConvertStoriesPage;
