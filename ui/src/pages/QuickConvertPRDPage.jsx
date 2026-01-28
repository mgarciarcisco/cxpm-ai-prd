import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Markdown from 'react-markdown';
import SaveToProjectModal from '../components/quick-convert/SaveToProjectModal';
import './QuickConvertPRDPage.css';

// Input source options
const INPUT_SOURCES = {
  requirements: { id: 'requirements', label: 'Requirements', placeholder: 'Paste your requirements here...' },
  notes: { id: 'notes', label: 'Notes/Description', placeholder: 'Paste meeting notes, feature description, or any text to convert into a PRD...' },
};

// PRD type options
const PRD_TYPES = {
  detailed: { id: 'detailed', label: 'Detailed', description: 'Comprehensive PRD with all sections' },
  brief: { id: 'brief', label: 'Brief', description: 'Concise PRD with key sections only' },
};

// Section configurations for simulated generation
const DETAILED_SECTIONS = [
  { id: 'executive_summary', title: 'Executive Summary', order: 1 },
  { id: 'problem_statement', title: 'Problem Statement', order: 2 },
  { id: 'goals_and_objectives', title: 'Goals and Objectives', order: 3 },
  { id: 'target_users', title: 'Target Users', order: 4 },
  { id: 'proposed_solution', title: 'Proposed Solution', order: 5 },
  { id: 'functional_requirements', title: 'Functional Requirements', order: 6 },
  { id: 'non_functional_requirements', title: 'Non-Functional Requirements', order: 7 },
  { id: 'success_metrics', title: 'Success Metrics', order: 8 },
  { id: 'timeline_and_milestones', title: 'Timeline and Milestones', order: 9 },
  { id: 'risks_and_mitigations', title: 'Risks and Mitigations', order: 10 },
];

const BRIEF_SECTIONS = [
  { id: 'executive_summary', title: 'Executive Summary', order: 1 },
  { id: 'problem_statement', title: 'Problem Statement', order: 2 },
  { id: 'goals_and_objectives', title: 'Goals and Objectives', order: 3 },
  { id: 'proposed_solution', title: 'Proposed Solution', order: 4 },
  { id: 'next_steps', title: 'Next Steps', order: 5 },
];

// Section status enum
const SectionStatus = {
  PENDING: 'pending',
  GENERATING: 'generating',
  COMPLETED: 'completed',
};

// Simulated section content generator
const generateSectionContent = (sectionId, _inputText, _prdType) => {
  // Note: inputText and prdType can be used for more sophisticated content generation

  const contentTemplates = {
    executive_summary: `This document outlines the product requirements for the proposed solution based on the provided input. The goal is to deliver a comprehensive solution that addresses the identified needs and provides measurable value to users.`,
    problem_statement: `Based on the input provided, the key problem areas identified include:\n\n- Need for improved efficiency in current workflows\n- Gaps in existing functionality that impact user productivity\n- Requirements for better integration and automation\n\nThese challenges require a thoughtful solution that addresses root causes while being practical to implement.`,
    goals_and_objectives: `**Primary Goals:**\n\n1. Improve user experience and workflow efficiency\n2. Address the core requirements identified in the input\n3. Deliver measurable improvements within the target timeframe\n\n**Key Objectives:**\n\n- Reduce friction in daily tasks\n- Provide clear visibility into progress and outcomes\n- Enable better collaboration and communication`,
    target_users: `The primary users for this solution include:\n\n**Primary Users:**\n- End users who will interact with the system daily\n- Team leads who need oversight and management capabilities\n\n**Secondary Users:**\n- Administrators who configure and maintain the system\n- Stakeholders who require reporting and analytics`,
    proposed_solution: `The proposed solution addresses the identified requirements through:\n\n**Core Features:**\n\n1. Streamlined user interface for common tasks\n2. Automated workflows to reduce manual effort\n3. Real-time updates and notifications\n4. Integration with existing tools and systems\n\n**Implementation Approach:**\n\nThe solution will be delivered in phases, starting with core functionality and expanding based on user feedback.`,
    functional_requirements: `**Core Requirements:**\n\n| ID | Requirement | Priority |\n|----|-------------|----------|\n| FR-1 | User authentication and authorization | High |\n| FR-2 | Data input and validation | High |\n| FR-3 | Processing and transformation | Medium |\n| FR-4 | Output generation and export | Medium |\n| FR-5 | Notifications and alerts | Low |\n\n**User Stories:**\n\n- As a user, I want to easily input my data so that I can get results quickly\n- As a team lead, I want to track progress so that I can manage workloads effectively`,
    non_functional_requirements: `**Performance:**\n- Response time under 2 seconds for common operations\n- Support for concurrent users\n\n**Security:**\n- Data encryption at rest and in transit\n- Role-based access control\n\n**Reliability:**\n- 99.9% uptime target\n- Automated backups and recovery`,
    success_metrics: `**Key Performance Indicators:**\n\n| Metric | Target | Measurement |\n|--------|--------|-------------|\n| User Adoption | 80% within 30 days | Active users / Total users |\n| Task Completion Time | 50% reduction | Average time per task |\n| User Satisfaction | 4.0+ rating | Survey scores |\n| Error Rate | <1% | Errors / Total operations |`,
    timeline_and_milestones: `**Phase 1: Foundation (Weeks 1-4)**\n- Core infrastructure setup\n- Basic functionality implementation\n- Initial testing\n\n**Phase 2: Feature Development (Weeks 5-8)**\n- Primary feature implementation\n- Integration development\n- User testing\n\n**Phase 3: Launch (Weeks 9-12)**\n- Final testing and bug fixes\n- Documentation completion\n- Staged rollout`,
    risks_and_mitigations: `| Risk | Impact | Likelihood | Mitigation |\n|------|--------|------------|------------|\n| Technical complexity | High | Medium | Phased approach, regular reviews |\n| Resource constraints | Medium | Medium | Early resource planning |\n| Scope creep | High | High | Clear requirements, change process |\n| Integration challenges | Medium | Low | Early integration testing |`,
    next_steps: `**Immediate Actions:**\n\n1. Review and approve this PRD\n2. Identify team members and resources\n3. Set up project tracking and communication\n\n**Next Phase:**\n\n- Detailed technical design\n- Resource allocation\n- Sprint planning and kickoff`,
  };

  return contentTemplates[sectionId] || `Content for ${sectionId} section will be generated based on the provided requirements.`;
};

/**
 * Quick Convert PRD page - input UI for generating PRDs.
 * Allows users to paste content or upload a file, then generate a PRD.
 * Can receive pre-filled requirements via navigation state.
 */
function QuickConvertPRDPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [inputSource, setInputSource] = useState('requirements');

  // Pre-fill content if navigated from requirements extraction
  useEffect(() => {
    if (location.state?.requirementsText) {
      setContent(location.state.requirementsText);
      setInputSource('requirements');
    }
  }, [location.state]);
  const [prdType, setPrdType] = useState('detailed');
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState(null);
  const [fileError, setFileError] = useState(null);
  const fileInputRef = useRef(null);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState(null);
  const [sections, setSections] = useState({});
  const [completedSections, setCompletedSections] = useState(0);
  const [totalSections, setTotalSections] = useState(0);

  // Result state
  const [generatedPRD, setGeneratedPRD] = useState(null);
  const [activeTab, setActiveTab] = useState('preview'); // 'preview' or 'edit'
  const [editContent, setEditContent] = useState('');

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

  // Simulate section-by-section PRD generation
  const simulateGeneration = useCallback(async (inputText, type) => {
    const sectionConfig = type === 'detailed' ? DETAILED_SECTIONS : BRIEF_SECTIONS;
    const total = sectionConfig.length;
    setTotalSections(total);
    setCompletedSections(0);

    // Initialize sections as pending
    const initialSections = {};
    sectionConfig.forEach(section => {
      initialSections[section.id] = {
        id: section.id,
        title: section.title,
        order: section.order,
        status: SectionStatus.PENDING,
        content: '',
      };
    });
    setSections(initialSections);

    // Generate each section with simulated streaming delay
    for (let i = 0; i < sectionConfig.length; i++) {
      const section = sectionConfig[i];

      // Mark section as generating
      setSections(prev => ({
        ...prev,
        [section.id]: {
          ...prev[section.id],
          status: SectionStatus.GENERATING,
        },
      }));

      // Simulate generation delay (200-500ms per section for quick feedback)
      await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 200));

      // Generate content for the section
      const sectionContent = generateSectionContent(section.id, inputText, type);

      // Mark section as completed
      setSections(prev => ({
        ...prev,
        [section.id]: {
          ...prev[section.id],
          status: SectionStatus.COMPLETED,
          content: sectionContent,
        },
      }));

      setCompletedSections(i + 1);
    }

    return sectionConfig;
  }, []);

  const handleGenerate = async () => {
    if (!hasContent) return;

    setIsGenerating(true);
    setGenerationError(null);
    setGeneratedPRD(null);
    setSections({});
    setCompletedSections(0);

    try {
      await simulateGeneration(content, prdType);

      // Build the final PRD from completed sections
      setSections(prev => {
        const sortedSections = Object.values(prev).sort((a, b) => a.order - b.order);
        const markdown = sortedSections
          .filter(s => s.status === SectionStatus.COMPLETED)
          .map(s => `## ${s.title}\n\n${s.content}`)
          .join('\n\n');

        setGeneratedPRD({
          sections: sortedSections,
          markdown,
          type: prdType,
          generatedAt: new Date().toISOString(),
        });
        setEditContent(markdown);
        return prev;
      });
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
    setGeneratedPRD(null);
    setSections({});
    setContent('');
    setFileName(null);
    setActiveTab('preview');
    setEditContent('');
  };

  // Get sorted sections for display
  const getSortedSections = () => {
    return Object.values(sections).sort((a, b) => a.order - b.order);
  };

  // Handle Save to Project button click
  const handleSaveToProject = () => {
    setShowSaveModal(true);
  };

  // Handle Generate Stories - navigate to stories page with PRD content
  const handleGenerateStories = () => {
    // Pass the PRD markdown content to the stories page
    const prdMarkdown = activeTab === 'edit' ? editContent : generatedPRD?.markdown;
    navigate('/quick-convert/stories', {
      state: { prdText: prdMarkdown },
    });
  };

  // Handle Download - download PRD as Markdown file
  const handleDownload = () => {
    const markdownContent = activeTab === 'edit' ? editContent : generatedPRD?.markdown;
    if (!markdownContent) return;

    // Create a title from the first section or use default
    const title = 'PRD_' + new Date().toISOString().split('T')[0];

    // Create blob and trigger download
    const blob = new Blob([markdownContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Render the input form (when no results yet and not generating)
  const renderInputForm = () => (
    <>
      {/* Input Source Toggle */}
      <div className="qc-prd__input-section">
        <div className="qc-prd__toggle-group">
          <span className="qc-prd__toggle-label">Input Source</span>
          <div className="qc-prd__toggle-buttons">
            {Object.values(INPUT_SOURCES).map((source) => (
              <button
                key={source.id}
                type="button"
                className={`qc-prd__toggle-btn ${inputSource === source.id ? 'qc-prd__toggle-btn--active' : ''}`}
                onClick={() => setInputSource(source.id)}
              >
                {source.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="qc-prd__content-area">
          <label htmlFor="prd-content" className="qc-prd__label">
            {INPUT_SOURCES[inputSource].label}
          </label>
          <textarea
            id="prd-content"
            className="qc-prd__textarea"
            placeholder={INPUT_SOURCES[inputSource].placeholder}
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              if (fileName) setFileName(null);
            }}
            rows={12}
          />
        </div>

        <div className="qc-prd__divider">
          <span>or</span>
        </div>

        {/* File Upload Zone */}
        <div
          className={`qc-prd__upload-zone ${dragActive ? 'qc-prd__upload-zone--active' : ''}`}
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
            className="qc-prd__file-input"
            aria-label="Upload file"
          />
          <svg
            className="qc-prd__upload-icon"
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
          <span className="qc-prd__upload-text">
            {dragActive ? 'Drop file here' : 'Click or drag file here'}
          </span>
          <span className="qc-prd__upload-hint">
            Supports .txt and .md files
          </span>
        </div>

        {fileError && (
          <div className="qc-prd__error" role="alert">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{fileError}</span>
          </div>
        )}

        {fileName && (
          <div className="qc-prd__file-info">
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
            <span className="qc-prd__file-name">{fileName}</span>
            <button
              type="button"
              className="qc-prd__file-clear"
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

      {/* PRD Type Toggle */}
      <div className="qc-prd__options-section">
        <div className="qc-prd__toggle-group">
          <span className="qc-prd__toggle-label">PRD Type</span>
          <div className="qc-prd__type-options">
            {Object.values(PRD_TYPES).map((type) => (
              <label key={type.id} className="qc-prd__type-option">
                <input
                  type="radio"
                  name="prd-type"
                  value={type.id}
                  checked={prdType === type.id}
                  onChange={(e) => setPrdType(e.target.value)}
                  className="qc-prd__type-radio"
                />
                <div className="qc-prd__type-content">
                  <span className="qc-prd__type-label">{type.label}</span>
                  <span className="qc-prd__type-description">{type.description}</span>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div className="qc-prd__actions">
        <button
          type="button"
          className="qc-prd__generate-btn"
          onClick={handleGenerate}
          disabled={!hasContent}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M16 13H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M16 17H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M10 9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Generate PRD
        </button>
      </div>
    </>
  );

  // Render generation progress view
  const renderGenerating = () => {
    const sortedSections = getSortedSections();

    return (
      <div className="qc-prd__generation">
        {/* Progress header */}
        <div className="qc-prd__generation-header">
          <div className="qc-prd__generation-progress">
            <div className="qc-prd__spinner" />
            <span className="qc-prd__generation-status">
              {totalSections > 0
                ? `Generating... Section ${completedSections + 1} of ${totalSections}`
                : 'Starting generation...'}
            </span>
          </div>
          <div className="qc-prd__generation-mode">
            {prdType === 'detailed' ? 'Detailed' : 'Brief'} PRD
          </div>
        </div>

        {/* Progress bar */}
        {totalSections > 0 && (
          <div className="qc-prd__progress-bar">
            <div
              className="qc-prd__progress-fill"
              style={{ width: `${(completedSections / totalSections) * 100}%` }}
            />
          </div>
        )}

        {/* Sections */}
        <div className="qc-prd__sections">
          {sortedSections.map((section) => (
            <div
              key={section.id}
              className={`qc-prd__section qc-prd__section--${section.status}`}
            >
              {/* Section header */}
              <div className="qc-prd__section-header">
                <span className="qc-prd__section-status-icon">
                  {section.status === SectionStatus.COMPLETED && (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M13.5 4.5L6 12L2.5 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                  {section.status === SectionStatus.GENERATING && (
                    <div className="qc-prd__section-spinner" />
                  )}
                  {section.status === SectionStatus.PENDING && (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2"/>
                    </svg>
                  )}
                </span>
                <span className="qc-prd__section-title">{section.title}</span>
              </div>

              {/* Section content - show for completed or generating sections */}
              {(section.status === SectionStatus.COMPLETED || section.status === SectionStatus.GENERATING) && section.content && (
                <div className="qc-prd__section-content">
                  <Markdown>{section.content}</Markdown>
                </div>
              )}

              {/* Pending placeholder */}
              {section.status === SectionStatus.PENDING && (
                <div className="qc-prd__section-placeholder">
                  Waiting to generate...
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render error state
  const renderError = () => (
    <div className="qc-prd__error-view">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <h2 className="qc-prd__error-title">Generation Failed</h2>
      <p className="qc-prd__error-text">{generationError}</p>
      <div className="qc-prd__error-actions">
        <button type="button" onClick={handleRetry}>Try Again</button>
        <button type="button" className="secondary" onClick={handleStartOver}>Start Over</button>
      </div>
    </div>
  );

  // Render generated PRD with Preview/Edit tabs
  const renderResult = () => (
    <div className="qc-prd__result">
      {/* Result header */}
      <div className="qc-prd__result-header">
        <button
          type="button"
          className="qc-prd__start-over-btn"
          onClick={handleStartOver}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          Start Over
        </button>
      </div>

      {/* PRD Viewer */}
      <div className="qc-prd__viewer">
        {/* Tabs header */}
        <div className="qc-prd__viewer-header">
          <div className="qc-prd__tabs">
            <button
              className={`qc-prd__tab ${activeTab === 'preview' ? 'qc-prd__tab--active' : ''}`}
              onClick={() => setActiveTab('preview')}
            >
              Preview
            </button>
            <button
              className={`qc-prd__tab ${activeTab === 'edit' ? 'qc-prd__tab--active' : ''}`}
              onClick={() => setActiveTab('edit')}
            >
              Edit
            </button>
          </div>
          <div className="qc-prd__viewer-meta">
            <span className="qc-prd__viewer-type">
              {prdType === 'detailed' ? 'Detailed' : 'Brief'} PRD
            </span>
          </div>
        </div>

        {/* Content area */}
        <div className="qc-prd__viewer-content">
          {activeTab === 'preview' ? (
            <div className="qc-prd__preview">
              {generatedPRD?.sections?.map((section) => (
                <div key={section.id} className="qc-prd__preview-section">
                  <h2 className="qc-prd__preview-section-title">{section.title}</h2>
                  <div className="qc-prd__preview-section-content">
                    <Markdown>{section.content}</Markdown>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <textarea
              className="qc-prd__editor"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder="Edit your PRD content here..."
            />
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="qc-prd__result-actions">
        <button
          type="button"
          className="qc-prd__action-btn qc-prd__action-btn--secondary"
          onClick={handleDownload}
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
          className="qc-prd__action-btn qc-prd__action-btn--secondary"
          onClick={handleSaveToProject}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
          Save to Project
        </button>
        <button
          type="button"
          className="qc-prd__action-btn qc-prd__action-btn--primary"
          onClick={handleGenerateStories}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="8" y1="12" x2="16" y2="12" />
            <line x1="12" y1="16" x2="12" y2="8" />
          </svg>
          Generate Stories
        </button>
      </div>
    </div>
  );

  return (
    <main className="main-content">
      <section className="qc-prd">
        {/* Back Link */}
        <Link to="/quick-convert" className="qc-prd__back-link">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to Quick Convert
        </Link>

        {/* Header */}
        <div className="qc-prd__header">
          <div className="qc-prd__icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 13H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M16 17H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M10 9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="qc-prd__header-content">
            <h1 className="qc-prd__title">
              {generatedPRD ? 'Generated PRD' : 'Generate PRD'}
            </h1>
            <p className="qc-prd__subtitle">
              {generatedPRD
                ? 'Review and edit your generated PRD below.'
                : 'Transform requirements or notes into a comprehensive Product Requirements Document.'}
            </p>
          </div>
        </div>

        {/* Conditional Content */}
        {isGenerating && renderGenerating()}
        {generationError && !isGenerating && renderError()}
        {generatedPRD && !isGenerating && renderResult()}
        {!generatedPRD && !isGenerating && !generationError && renderInputForm()}
      </section>

      {/* Save to Project Modal */}
      {showSaveModal && (
        <SaveToProjectModal
          onClose={() => setShowSaveModal(false)}
          dataType="prd"
          data={{
            title: 'Generated PRD',
            sections: generatedPRD?.sections || [],
            markdown: activeTab === 'edit' ? editContent : generatedPRD?.markdown,
          }}
        />
      )}
    </main>
  );
}

export default QuickConvertPRDPage;
