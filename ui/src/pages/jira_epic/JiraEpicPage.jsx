import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Breadcrumbs from '../../components/common/Breadcrumbs';
import Modal from '../../components/common/Modal';
import { generateJiraEpic, saveJiraStories, listJiraStories, deleteJiraStories, get } from '../../services/api';
import './JiraEpicPage.css';

function JiraEpicPage() {
  const [error, setError] = useState(null);
  const [epics, setEpics] = useState([]);
  const [selectedEpic, setSelectedEpic] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [epicsLoadedFromDB, setEpicsLoadedFromDB] = useState(false);
  const [loadingExistingEpics, setLoadingExistingEpics] = useState(false);
  const [showReplaceConfirmation, setShowReplaceConfirmation] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [showGenerateSuccess, setShowGenerateSuccess] = useState(false);
  const rowsPerPage = 30;
  
  // Project and requirements selection state
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  const [showRequirementsSelector, setShowRequirementsSelector] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projects, setProjects] = useState([]);
  const [functionalRequirements, setFunctionalRequirements] = useState([]);
  const [selectedRequirements, setSelectedRequirements] = useState(new Set());
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingRequirements, setLoadingRequirements] = useState(false);
  const [projectRequirementsText, setProjectRequirementsText] = useState('');

  // Ref for scrolling to epics section
  const epicsDisplayRef = useRef(null);

  // Breadcrumb items
  const breadcrumbItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'User Stories' },
  ];

  // Load selected project from localStorage on mount
  useEffect(() => {
    const savedProject = localStorage.getItem('jiraEpic_selectedProject');
    if (savedProject) {
      try {
        const project = JSON.parse(savedProject);
        setSelectedProject(project);
      } catch (err) {
        console.error('Failed to load saved project:', err);
        localStorage.removeItem('jiraEpic_selectedProject');
      }
    }
  }, []);

  // Load existing JIRA stories when project is selected
  useEffect(() => {
    const loadExistingStories = async () => {
      if (!selectedProject?.id) {
        return;
      }

      setLoadingExistingEpics(true);
      setError(null);

      try {
        const stories = await listJiraStories(selectedProject.id);
        
        if (stories && stories.length > 0) {
          // Convert database stories to epic format
          const loadedEpics = stories.map((story, index) => ({
            id: index + 1, // Display ID for table
            databaseId: story.id, // Store actual database UUID
            name: story.title,
            title: story.title,
            description: story.description || '',
            problemStatement: story.problem_statement || '',
            targetUserRoles: story.target_user_roles || '',
            dataSources: story.data_sources || '',
            businessRules: story.business_rules || '',
            responseExample: story.response_example || '',
            acceptanceCriteria: story.acceptance_criteria || '',
            content: `**Title:** ${story.title}\n\n` +
                     (story.description ? `**Description:** ${story.description}\n\n` : '') +
                     (story.problem_statement ? `**Problem Statement:** ${story.problem_statement}\n\n` : '') +
                     (story.target_user_roles ? `**Target User Roles:** ${story.target_user_roles}\n\n` : '') +
                     (story.data_sources ? `**Data Sources:** ${story.data_sources}\n\n` : '') +
                     (story.business_rules ? `**Business Rules:** ${story.business_rules}\n\n` : '') +
                     (story.response_example ? `**Response Example:** ${story.response_example}\n\n` : '') +
                     (story.acceptance_criteria ? `**Acceptance Criteria:** ${story.acceptance_criteria}` : '')
          }));

          setEpics(loadedEpics);
          setSelectedEpic(loadedEpics[0]);
          setEpicsLoadedFromDB(true);
          console.log(`Loaded ${loadedEpics.length} existing JIRA stories from database`);
        } else {
          // No existing stories
          setEpics([]);
          setSelectedEpic(null);
          setEpicsLoadedFromDB(false);
        }
      } catch (err) {
        console.error('Error loading existing JIRA stories:', err);
        // Don't show error to user if no stories exist
        setEpics([]);
        setSelectedEpic(null);
        setEpicsLoadedFromDB(false);
      } finally {
        setLoadingExistingEpics(false);
      }
    };

    loadExistingStories();
  }, [selectedProject]);

  // Fetch projects list
  const fetchProjects = async () => {
    try {
      setLoadingProjects(true);
      const projectsData = await get('/api/projects');
      // Filter out archived projects and sort by updated_at desc
      const activeProjects = projectsData
        .filter(p => !p.archived)
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
      setProjects(activeProjects);
    } catch (err) {
      setError('Failed to load projects: ' + err.message);
    } finally {
      setLoadingProjects(false);
    }
  };

  // Fetch functional requirements for selected project
  const fetchFunctionalRequirements = async (projectId) => {
    try {
      setLoadingRequirements(true);
      const requirementsData = await get(`/api/projects/${projectId}/requirements`);
      const funcReqs = requirementsData.functional_requirements || [];
      setFunctionalRequirements(funcReqs);
      // Select all by default
      setSelectedRequirements(new Set(funcReqs.map(req => req.id)));
    } catch (err) {
      setError('Failed to load requirements: ' + err.message);
    } finally {
      setLoadingRequirements(false);
    }
  };

  // Handle Add Project Functional Requirements button click
  const handleAddFunctionalRequirements = async () => {
    setError(null);
    
    // If no project is selected, show project selector
    if (!selectedProject) {
      await fetchProjects();
      setShowProjectSelector(true);
    } else {
      // If project is selected, show requirements selector
      await fetchFunctionalRequirements(selectedProject.id);
      setShowRequirementsSelector(true);
    }
  };

  // Handle project selection from modal
  const handleProjectSelect = async (project) => {
    setSelectedProject(project);
    
    // Save selected project to localStorage
    localStorage.setItem('jiraEpic_selectedProject', JSON.stringify(project));
    
    setShowProjectSelector(false);
    
    // Fetch requirements for selected project
    await fetchFunctionalRequirements(project.id);
    setShowRequirementsSelector(true);
  };

  // Handle requirement checkbox toggle
  const handleRequirementToggle = (reqId) => {
    setSelectedRequirements(prev => {
      const newSet = new Set(prev);
      if (newSet.has(reqId)) {
        newSet.delete(reqId);
      } else {
        newSet.add(reqId);
      }
      return newSet;
    });
  };

  // Handle Apply button in requirements selector
  const handleApplyRequirements = () => {
    const selectedReqs = functionalRequirements.filter(req => selectedRequirements.has(req.id));
    
    if (selectedReqs.length === 0) {
      setError('Please select at least one requirement');
      return;
    }
    
    // Format requirements as text
    const requirementsText = selectedReqs
      .map((req, index) => `${index + 1}. ${req.content}`)
      .join('\n\n');
    
    // Replace project requirements textbox content with new requirements
    setProjectRequirementsText(`--- Functional Requirements from ${selectedProject.name} ---\n\n${requirementsText}`);
    
    setShowRequirementsSelector(false);
  };

  const handleGenerate = async () => {
    // Check if there are existing epics (either loaded from DB or newly generated)
    if (epics.length > 0) {
      // Show confirmation modal
      setShowReplaceConfirmation(true);
      return;
    }

    // No existing epics, proceed with generation
    await performGeneration();
  };

  const performGeneration = async () => {
    // Clear all previous epics, selections, and pagination immediately when button is clicked
    setEpics([]);
    setSelectedEpic(null);
    setCurrentPage(1);
    setError(null);
    setEpicsLoadedFromDB(false);
    
    // Validate input
    if (!projectRequirementsText.trim()) {
      setError('Please add project functional requirements to continue.');
      return;
    }

    setIsGenerating(true);

    try {
      const combinedContent = projectRequirementsText.trim();
      
      // Call backend API to generate JIRA Epic
      const response = await generateJiraEpic(combinedContent);
      
      if (!response || !response.epic) {
        throw new Error('Invalid response from server');
      }
      
      // Parse the generated epic content into multiple epics
      const generatedEpics = parseEpicsFromResponse(response.epic);
      
      // Debug: Log parsed epics
      console.log('Parsed epics:', generatedEpics.length, generatedEpics);
      
      if (generatedEpics.length === 0) {
        throw new Error('No valid stories were generated. Please check your requirements file.');
      }
      
      setEpics(generatedEpics);
      
      // Select the first epic by default
      setSelectedEpic(generatedEpics[0]);

      // Show success notification
      setShowGenerateSuccess(true);
      
      // Auto-hide notification after 4 seconds
      setTimeout(() => {
        setShowGenerateSuccess(false);
      }, 4000);

      // Scroll to the epics section after a brief delay to ensure DOM update
      setTimeout(() => {
        if (epicsDisplayRef.current) {
          epicsDisplayRef.current.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
          });
        }
      }, 100);
    } catch (err) {
      // Ensure epics are cleared on error (safety measure)
      setEpics([]);
      setSelectedEpic(null);
      
      // Handle different error types
      const errorMessage = err.message || 'Failed to generate JIRA Stories';
      
      if (errorMessage.includes('503') || errorMessage.includes('unavailable')) {
        setError('LLM service is not available. Please ensure Ollama is running and try again.');
      } else if (errorMessage.includes('400')) {
        setError('Invalid requirements. Please check your file content and try again.');
      } else {
        setError(`Failed to generate JIRA Stories: ${errorMessage}`);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirmReplace = async () => {
    setShowReplaceConfirmation(false);

    // Delete existing stories if they were loaded from database
    if (epicsLoadedFromDB && selectedProject) {
      try {
        await deleteJiraStories(selectedProject.id);
        console.log('Deleted existing JIRA stories from database');
      } catch (err) {
        console.error('Error deleting existing stories:', err);
        setError('Failed to delete existing stories. Please try again.');
        return;
      }
    }

    // Proceed with generation
    await performGeneration();
  };

  const handleCancelReplace = () => {
    setShowReplaceConfirmation(false);
  };

  const handleSaveJiraStories = async () => {
    if (!epics || epics.length === 0) {
      setError('No stories to save.');
      return;
    }

    if (!selectedProject) {
      setError('Please select a project before saving JIRA stories.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Map epics to the format expected by the API
      const epicData = epics.map(epic => ({
        title: epic.title || epic.name || 'Untitled Epic',
        description: epic.description || null,
        problem_statement: epic.problemStatement || null,
        target_user_roles: epic.targetUserRoles || null,
        data_sources: epic.dataSources || null,
        business_rules: epic.businessRules || null,
        response_example: epic.responseExample || null,
        acceptance_criteria: epic.acceptanceCriteria || null,
        reporter: null, // Can be set if you have user info
        notes: null, // Can be set if needed
        parent_jira_id: null, // Can be set if there's a parent JIRA
      }));

      // Call the API to save JIRA stories
      const response = await saveJiraStories(selectedProject.id, epicData);

      // Mark epics as loaded from database (so save button will be disabled)
      setEpicsLoadedFromDB(true);

      // Show success modal
      setError(null);
      setSavedCount(response.saved_count);
      setShowSaveSuccess(true);
      
      console.log('Saved JIRA stories:', response.saved_stories);
      
    } catch (err) {
      const errorMessage = err.message || 'Failed to save JIRA stories';
      setError(`Failed to save JIRA stories: ${errorMessage}`);
      console.error('Error saving JIRA stories:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Parse the response into multiple epics with structured sections
  const parseEpicsFromResponse = (content) => {
    if (!content || !content.trim()) {
      return [];
    }
    
    // Split content by "Title:" or "**Title:**" to identify multiple epics
    // Looking for: Title:, **Title:**, **Title**, Title
    const epicSections = content.split(/(?=^\s*\*{0,2}\s*Title\s*:?\s*\*{0,2})/gim)
      .map(s => s.trim())
      .filter(s => s.length > 0 && /Title\s*:/i.test(s)); // Only keep sections that have "Title:"
    
    if (epicSections.length === 0) {
      // If no sections found, treat entire content as single epic
      return [{
        id: 1,
        name: 'Generated Epic',
        title: 'Generated Epic',
        description: '',
        problemStatement: '',
        targetUserRoles: '',
        dataSources: '',
        businessRules: '',
        responseExample: '',
        acceptanceCriteria: '',
        content: content
      }];
    }
    
    // Map and filter to remove empty epics
    const parsedEpics = epicSections.map((epicText, index) => {
      // Helper function to extract section content
      const extractSection = (text, sectionName, nextSection = null) => {
        // Build pattern for all possible next section headers
        const allSections = [
          'Title',
          'Description', 
          'Problem Statement',
          'Target user roles',
          'Data Sources',
          'Business Rules and Error Handling',
          'Business Rules',
          'Response Example',
          'Acceptance Criteria'
        ];
        
        // Escape special regex characters in section name
        const escapedSectionName = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // Build lookahead pattern for next section(s)
        let nextSectionPattern;
        if (nextSection) {
          const escapedNext = nextSection.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          nextSectionPattern = escapedNext;
        } else {
          nextSectionPattern = allSections.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
        }
        
        // Pattern explanation:
        // (?:\*\*)? - Optionally match ** (bold marker)
        // \s* - Optional whitespace
        // ${escapedSectionName} - The section name we're looking for
        // \s*:?\s* - Optional colon with spaces
        // (?:\*\*)? - Optional closing bold marker
        // [^\S\r\n]* - Optional horizontal whitespace (spaces/tabs, not newlines)
        // [\r\n]+ - One or more line breaks
        // ([\s\S]*?) - Capture content (non-greedy)
        // (?=...) - Lookahead for next section or end of text
        
        // Try to match with lookahead for next section
        // Match: **Title:**  \n or Title:\n or **Title**\n
        // Capture everything until the next section header
        let regex = new RegExp(
          `(?:\\*\\*)?\\s*${escapedSectionName}\\s*:?\\s*(?:\\*\\*)?[^\\S\\r\\n]*[\\r\\n]+([\\s\\S]*?)(?=[\\r\\n]\\s*(?:\\*\\*)?\\s*(?:${nextSectionPattern})\\s*:?)`,
          'i'
        );
        let match = text.match(regex);
        
        if (!match) {
          // Try matching until end of text (for last section like Acceptance Criteria)
          regex = new RegExp(
            `(?:\\*\\*)?\\s*${escapedSectionName}\\s*:?\\s*(?:\\*\\*)?[^\\S\\r\\n]*[\\r\\n]+([\\s\\S]*)$`,
            'i'
          );
          match = text.match(regex);
        }
        
        if (!match) {
          // Try without bold markers - just find section name with colon
          regex = new RegExp(
            `${escapedSectionName}\\s*:[^\\S\\r\\n]*[\\r\\n]+([\\s\\S]*?)(?=[\\r\\n]\\s*(?:${nextSectionPattern})\\s*:)`,
            'i'
          );
          match = text.match(regex);
        }
        
        if (!match) {
          // Last resort - very loose pattern
          regex = new RegExp(
            `${escapedSectionName}[^\\n]*[\\r\\n]+([\\s\\S]*?)(?=[\\r\\n].*?(?:${nextSectionPattern}))`,
            'i'
          );
          match = text.match(regex);
        }
        
        return match ? match[1].trim() : '';
      };
      
      // Helper to clean up any section headers that leaked into the content
      const cleanupContent = (content, sectionName = '') => {
        if (!content) return '';
        let cleaned = content;
        const original = content;
        
        // List of all section headers to remove if they appear in content
        const sectionHeaders = [
          'Title',
          'Description',
          'Problem Statement',
          'Target user roles',
          'Data Sources',
          'Business Rules and Error Handling',
          'Business Rules',
          'Response Example',
          'Acceptance Criteria'
        ];
        
        // Remove any section headers that appear
        sectionHeaders.forEach(header => {
          const escapedHeader = header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          
          // Pattern 1: Remove header at the very end of content
          // Matches: \n**Header:** or \n**Header** or \nHeader: at end of string
          const patternEnd = new RegExp(`\\n\\s*(?:\\*\\*)?\\s*${escapedHeader}\\s*:?\\s*(?:\\*\\*)?\\s*$`, 'gi');
          cleaned = cleaned.replace(patternEnd, '');
          
          // Pattern 2: Remove standalone header lines (header on its own line, not followed by content on same line)
          // This removes: \n**Header:**\n and everything AFTER it (next section leaked in)
          const patternStandalone = new RegExp(`\\n\\s*(?:\\*\\*)?\\s*${escapedHeader}\\s*:?\\s*(?:\\*\\*)?\\s*$[\\s\\S]*$`, 'gim');
          cleaned = cleaned.replace(patternStandalone, '');
        });
        
        // Debug: Log if cleanup made changes
        if (original !== cleaned && sectionName) {
          console.log(`Cleaned content from "${sectionName}"`, {
            originalLength: original.length,
            cleanedLength: cleaned.length,
            removed: original.length - cleaned.length,
            cleanedPreview: cleaned.substring(0, 100)
          });
        }
        
        return cleaned.trim();
      };
      
      // Extract all sections
      // Note: Use full section names that match the headers in the generated content
      const rawTitle = extractSection(epicText, 'Title', 'Description');
      const rawDescription = extractSection(epicText, 'Description', 'Problem Statement');
      const rawProblemStatement = extractSection(epicText, 'Problem Statement', 'Target user roles');
      const rawTargetUserRoles = extractSection(epicText, 'Target user roles', 'Data Sources');
      const rawDataSources = extractSection(epicText, 'Data Sources', 'Business Rules and Error Handling');
      const rawBusinessRules = extractSection(epicText, 'Business Rules and Error Handling', 'Response Example');
      const rawResponseExample = extractSection(epicText, 'Response Example', 'Acceptance Criteria');
      const rawAcceptanceCriteria = extractSection(epicText, 'Acceptance Criteria');
      
      // Debug: Log raw extraction lengths and preview
      console.log('Raw extractions:', {
        title: `${rawTitle.length} chars: "${rawTitle.substring(0, 100)}"`,
        description: `${rawDescription.length} chars`,
        problemStatement: `${rawProblemStatement.length} chars`,
        targetUserRoles: `${rawTargetUserRoles.length} chars`,
        dataSources: `${rawDataSources.length} chars`,
        businessRules: `${rawBusinessRules.length} chars`,
        responseExample: `${rawResponseExample.length} chars`,
        acceptanceCriteria: `${rawAcceptanceCriteria.length} chars`
      });
      
      const title = cleanupContent(rawTitle, 'Title');
      const description = cleanupContent(rawDescription, 'Description');
      const problemStatement = cleanupContent(rawProblemStatement, 'Problem Statement');
      const targetUserRoles = cleanupContent(rawTargetUserRoles, 'Target user roles');
      const dataSources = cleanupContent(rawDataSources, 'Data Sources');
      const businessRules = cleanupContent(rawBusinessRules, 'Business Rules and Error Handling');
      const responseExample = cleanupContent(rawResponseExample, 'Response Example');
      const acceptanceCriteria = cleanupContent(rawAcceptanceCriteria, 'Acceptance Criteria');
      
      // Debug: Log cleaned title
      console.log(`Epic ${index + 1} cleaned title: "${title}"`);
      
      const name = title || `Epic ${index + 1}`;
      
      return {
        id: index + 1,
        name: name,
        title: title,
        description: description,
        problemStatement: problemStatement,
        targetUserRoles: targetUserRoles,
        dataSources: dataSources,
        businessRules: businessRules,
        responseExample: responseExample,
        acceptanceCriteria: acceptanceCriteria,
        content: epicText.trim(),
        isEmpty: !title && !description && !problemStatement && !targetUserRoles && !dataSources && !businessRules && !responseExample && !acceptanceCriteria
      };
    })
    .filter(epic => !epic.isEmpty) // Filter out empty epics
    .map((epic, index) => ({
      ...epic,
      id: index + 1, // Re-index after filtering
      isEmpty: undefined // Remove the isEmpty flag
    }));
    
    return parsedEpics.length > 0 ? parsedEpics : [{
      id: 1,
      name: 'Generated Epic',
      title: 'Generated Epic',
      description: '',
      problemStatement: '',
      targetUserRoles: '',
      dataSources: '',
      businessRules: '',
      responseExample: '',
      acceptanceCriteria: '',
      content: content
    }];
  };


  // Enhanced markdown renderer with table support
  const renderMarkdown = (text) => {
    if (!text) return '';
    
    let html = text;
    
    // Process tables first (before line breaks are converted)
    // Match markdown tables: | col1 | col2 | followed by separator row and data rows
    const tableRegex = /(\|[^\n]+\|\r?\n\|[-:\s|]+\|\r?\n(?:\|[^\n]+\|\r?\n?)*)/g;
    html = html.replace(tableRegex, (match) => {
      const lines = match.trim().split('\n');
      if (lines.length < 2) return match;
      
      // Parse header row
      const headers = lines[0].split('|').map(h => h.trim()).filter(h => h);
      
      // Skip separator row (lines[1])
      
      // Parse data rows
      const rows = lines.slice(2).map(line => 
        line.split('|').map(cell => cell.trim()).filter(cell => cell)
      ).filter(row => row.length > 0);
      
      // Build HTML table
      let tableHtml = '<table class="markdown-table"><thead><tr>';
      headers.forEach(header => {
        tableHtml += `<th>${header}</th>`;
      });
      tableHtml += '</tr></thead><tbody>';
      
      rows.forEach(row => {
        tableHtml += '<tr>';
        row.forEach(cell => {
          tableHtml += `<td>${cell}</td>`;
        });
        tableHtml += '</tr>';
      });
      
      tableHtml += '</tbody></table>';
      return tableHtml;
    });
    
    // Basic markdown rendering
    html = html
      // Headers
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Code blocks
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      // Inline code
      .replace(/`(.+?)`/g, '<code>$1</code>')
      // Horizontal rule
      .replace(/^---$/gim, '<hr />')
      // Line breaks
      .replace(/\n/g, '<br />');
    
    return html;
  };

  const isSubmitDisabled = isGenerating || !projectRequirementsText.trim();

  // Calculate pagination
  const totalPages = Math.ceil(epics.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const currentEpics = epics.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleEpicSelect = (epic) => {
    setSelectedEpic(epic);
  };

  return (
    <main className="main-content">
      <Breadcrumbs items={breadcrumbItems} />

      <section className="upload-section">
        {/* Page Header */}
        <div className="upload-header">
          <h1>User Stories{selectedProject ? `: ${selectedProject.name}` : ''}</h1>
          <p className="upload-header__subtitle">
            Generate actionable user stories from your requirements
          </p>
        </div>

        <div className="upload-layout">
          {/* Form */}
          <div className="upload-form">
            {/* Add Project Functional Requirements Button */}
            <div className="form-group">
              <button
                type="button"
                className="form-btn form-btn--outline requirements-btn"
                onClick={handleAddFunctionalRequirements}
                disabled={isGenerating}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 12h6M12 9v6M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                Add Project Functional Requirements
              </button>
              {selectedProject && (
                <p className="form-hint form-hint--info">
                  Using requirements from: <strong>{selectedProject.name}</strong>
                </p>
              )}
            </div>

            {/* Project Requirements Textbox - Only visible when requirements are added */}
            {projectRequirementsText && (
              <div className="form-group">
                <label htmlFor="project-requirements" className="form-label">
                  Project Functional Requirements
                  <span className="form-label-hint"> (from {selectedProject?.name})</span>
                </label>
                <textarea
                  id="project-requirements"
                  className="form-textarea"
                  value={projectRequirementsText}
                  onChange={(e) => setProjectRequirementsText(e.target.value)}
                  placeholder="Project functional requirements will appear here..."
                  rows={8}
                />
                <p className="form-hint">
                  These requirements were loaded from your project. You can edit them or click "Add Project Functional Requirements" to load different ones.
                </p>
              </div>
            )}

            {error && (
              <div className="form-error">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12zM8 5v3M8 11h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>{error}</span>
              </div>
            )}

            <div className="form-actions">
              <Link to="/dashboard" className="form-btn form-btn--secondary">
                Cancel
              </Link>
              <div
                className="btn-wrapper"
                title={isSubmitDisabled ? 'Add project functional requirements to continue' : ''}
              >
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="form-btn form-btn--primary"
                  disabled={isSubmitDisabled}
                >
                  {isGenerating ? (
                    <>
                      <span className="btn-spinner"></span>
                      Generating (may take up to 5 min)...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="16 18 22 12 16 6"/>
                        <polyline points="8 6 2 12 8 18"/>
                      </svg>
                      Generate JIRA Stories
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Tips Panel */}
          <aside className="tips-panel">
            <div className="tips-panel__header">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 16v-4M12 8h.01"/>
              </svg>
              Tips for Best Results
            </div>
            <ul className="tips-panel__list">
              <li>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13.5 4.5L6 12L2.5 8.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>Focus on user value and benefits, not implementation</span>
              </li>
              <li>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13.5 4.5L6 12L2.5 8.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>Keep stories small, independent, and deliverable</span>
              </li>
              <li>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13.5 4.5L6 12L2.5 8.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>Include specific, testable acceptance criteria</span>
              </li>
              <li>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13.5 4.5L6 12L2.5 8.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>Describe the "who," "what," and "why" clearly</span>
              </li>
            </ul>
            <div className="tips-panel__example">
              <div className="tips-panel__example-label">Expected Format</div>
              <div className="tips-panel__example-text">
                Your requirements should describe:{'\n'}
                {'\n'}
                • The user persona or role{'\n'}
                • The specific action or capability needed{'\n'}
                • The business value or benefit{'\n'}
                • Clear acceptance criteria{'\n'}
                • Any relevant context or constraints{'\n'}
                {'\n'}
                The AI will structure these into proper JIRA User Stories.
              </div>
            </div>
          </aside>
        </div>

        {/* Success Notification Banner */}
        {showGenerateSuccess && (
          <div className="success-banner">
            <div className="success-banner-content">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <span>✓ {epics.length} JIRA {epics.length === 1 ? 'Story' : 'Stories'} successfully generated! Scroll down to view.</span>
            </div>
          </div>
        )}

        {/* Generated Stories Display */}
        {epics.length > 0 && (
          <>
          <div className="epics-display" ref={epicsDisplayRef}>
            <div className="epics-layout">
              {/* Left Side - Epics Table */}
              <div className="epics-table-container">
                <div className="epics-table-header">
                  <h2>Generated Stories ({epics.length})</h2>
                </div>
                
                <div className="epics-table-wrapper">
                  <table className="epics-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Story Name</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentEpics.map((epic) => (
                        <tr
                          key={epic.id}
                          className={selectedEpic?.id === epic.id ? 'selected' : ''}
                          onClick={() => handleEpicSelect(epic)}
                        >
                          <td className="epic-id">{epic.id}</td>
                          <td className="epic-name">{epic.name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="pagination">
                    <button
                      className="pagination-btn"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M10 12L6 8L10 4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Previous
                    </button>
                    
                    <div className="pagination-info">
                      Page {currentPage} of {totalPages}
                    </div>
                    
                    <button
                      className="pagination-btn"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M6 4L10 8L6 12" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {/* Right Side - Story Details */}
              <div className="epic-details-container">
                <div className="epic-details-header">
                  <h2>{selectedEpic ? selectedEpic.name : 'Select a Story'}</h2>
                  {selectedEpic && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(selectedEpic.content);
                      }}
                      className="copy-btn"
                      type="button"
                      title="Copy to clipboard"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </svg>
                      Copy
                    </button>
                  )}
                </div>
                
                <div className="epic-details-content">
                  {selectedEpic ? (
                    <div className="epic-sections">
                      {selectedEpic.title && (
                        <div className="epic-section">
                          <h3 className="epic-section-title">Title</h3>
                          <div className="epic-section-content">{selectedEpic.title}</div>
                        </div>
                      )}
                      
                      {selectedEpic.description && (
                        <div className="epic-section">
                          <h3 className="epic-section-title">Description</h3>
                          <div className="epic-section-content">
                            <div dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedEpic.description) }} />
                          </div>
                        </div>
                      )}
                      
                      {selectedEpic.problemStatement && (
                        <div className="epic-section">
                          <h3 className="epic-section-title">Problem Statement</h3>
                          <div className="epic-section-content">
                            <div dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedEpic.problemStatement) }} />
                          </div>
                        </div>
                      )}
                      
                      {selectedEpic.targetUserRoles && (
                        <div className="epic-section">
                          <h3 className="epic-section-title">Target User Roles</h3>
                          <div className="epic-section-content">
                            <div dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedEpic.targetUserRoles) }} />
                          </div>
                        </div>
                      )}
                      
                      {selectedEpic.dataSources && (
                        <div className="epic-section">
                          <h3 className="epic-section-title">Data Sources</h3>
                          <div className="epic-section-content">
                            <div dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedEpic.dataSources) }} />
                          </div>
                        </div>
                      )}
                      
                      {selectedEpic.businessRules && (
                        <div className="epic-section">
                          <h3 className="epic-section-title">Business Rules and Error Handling</h3>
                          <div className="epic-section-content">
                            <div dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedEpic.businessRules) }} />
                          </div>
                        </div>
                      )}
                      
                      {selectedEpic.responseExample && (
                        <div className="epic-section">
                          <h3 className="epic-section-title">Response Example</h3>
                          <div className="epic-section-content">
                            <div dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedEpic.responseExample) }} />
                          </div>
                        </div>
                      )}
                      
                      {selectedEpic.acceptanceCriteria && (
                        <div className="epic-section">
                          <h3 className="epic-section-title">Acceptance Criteria</h3>
                          <div className="epic-section-content">
                            <div dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedEpic.acceptanceCriteria) }} />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="epic-details-placeholder">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <line x1="9" y1="9" x2="15" y2="9"/>
                        <line x1="9" y1="13" x2="15" y2="13"/>
                        <line x1="9" y1="17" x2="13" y2="17"/>
                      </svg>
                      <p>Select a story from the table to view details</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Save Jira Stories Button */}
          <div className="save-jira-stories-container">
            <button
              className="form-btn form-btn--primary save-jira-stories-btn"
              onClick={handleSaveJiraStories}
              disabled={isSaving || !selectedProject || epicsLoadedFromDB}
            >
              {isSaving ? (
                <>
                  <div className="btn-spinner"></div>
                  Saving...
                </>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                    <polyline points="17 21 17 13 7 13 7 21"/>
                    <polyline points="7 3 7 8 15 8"/>
                  </svg>
                  Save Jira Stories
                </>
              )}
            </button>
            {!selectedProject && (
              <p className="save-hint">Please select a project to save JIRA stories</p>
            )}
          </div>
          </>
        )}
      </section>

      {/* Project Selector Modal */}
      {showProjectSelector && (
        <Modal
          title="Select Project"
          subtitle="Choose a project to load functional requirements from"
          onClose={() => setShowProjectSelector(false)}
          size="large"
        >
          <div className="project-selector-modal">
            {loadingProjects ? (
              <div className="modal-loading">
                <div className="loading-spinner"></div>
                <p>Loading projects...</p>
              </div>
            ) : projects.length === 0 ? (
              <div className="modal-empty">
                <p>No projects found. Create a project first.</p>
              </div>
            ) : (
              <div className="project-list">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className="project-option"
                    onClick={() => handleProjectSelect(project)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && handleProjectSelect(project)}
                  >
                    <div className="project-option__icon project-option__icon--folder">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                      </svg>
                    </div>
                    <div className="project-option__info">
                      <h3>{project.name}</h3>
                      <p>
                        {project.requirements_count > 0
                          ? `${project.requirements_count} requirements`
                          : 'Empty project'
                        }
                      </p>
                    </div>
                    <div className="project-option__meta">
                      <span className="project-option__count">
                        {project.requirements_count || 0} reqs
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Functional Requirements Selector Modal */}
      {showRequirementsSelector && (
        <Modal
          title="Select Functional Requirements"
          subtitle={selectedProject ? `From: ${selectedProject.name}` : ''}
          onClose={() => setShowRequirementsSelector(false)}
          size="large"
        >
          <div className="requirements-selector-modal">
            {loadingRequirements ? (
              <div className="modal-loading">
                <div className="loading-spinner"></div>
                <p>Loading requirements...</p>
              </div>
            ) : functionalRequirements.length === 0 ? (
              <div className="modal-empty">
                <p>No functional requirements found in this project.</p>
              </div>
            ) : (
              <>
                <div className="requirements-list">
                  <table className="requirements-table">
                    <thead>
                      <tr>
                        <th className="checkbox-col">
                          <input
                            type="checkbox"
                            checked={selectedRequirements.size === functionalRequirements.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedRequirements(new Set(functionalRequirements.map(req => req.id)));
                              } else {
                                setSelectedRequirements(new Set());
                              }
                            }}
                          />
                        </th>
                        <th>Requirement</th>
                      </tr>
                    </thead>
                    <tbody>
                      {functionalRequirements.map((req) => (
                        <tr key={req.id}>
                          <td className="checkbox-col">
                            <input
                              type="checkbox"
                              checked={selectedRequirements.has(req.id)}
                              onChange={() => handleRequirementToggle(req.id)}
                            />
                          </td>
                          <td className="requirement-content">{req.content}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="modal-footer">
                  <button
                    className="form-btn form-btn--secondary"
                    onClick={() => setShowRequirementsSelector(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="form-btn form-btn--primary"
                    onClick={handleApplyRequirements}
                    disabled={selectedRequirements.size === 0}
                  >
                    Add {selectedRequirements.size} Requirements
                  </button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* Replace Confirmation Modal */}
      {showReplaceConfirmation && (
        <Modal
          title="Replace Existing JIRA Stories?"
          subtitle="This action cannot be undone"
          onClose={handleCancelReplace}
          size="medium"
        >
          <div className="confirmation-modal-content">
            <div className="warning-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <p className="confirmation-message">
              All previous JIRA stories will be completely replaced. 
              {epicsLoadedFromDB && ' Existing stories in the database will be permanently deleted.'}
            </p>
            <p className="confirmation-question">Do you want to continue?</p>
          </div>
          <div className="modal-footer">
            <button
              className="form-btn form-btn--secondary"
              onClick={handleCancelReplace}
              autoFocus
            >
              Cancel
            </button>
            <button
              className="form-btn form-btn--danger"
              onClick={handleConfirmReplace}
            >
              Confirm
            </button>
          </div>
        </Modal>
      )}

      {/* Save Success Modal */}
      {showSaveSuccess && (
        <Modal
          title="Jira Stories Successfully Created"
          onClose={() => setShowSaveSuccess(false)}
          size="medium"
        >
          <div className="success-modal-content">
            <div className="success-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <p className="success-message">
              {savedCount} JIRA {savedCount === 1 ? 'story' : 'stories'} successfully saved to the database with unique IDs.
            </p>
          </div>
          <div className="modal-footer">
            <button
              className="form-btn form-btn--primary"
              onClick={() => setShowSaveSuccess(false)}
              autoFocus
            >
              Done
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}

export default JiraEpicPage;
