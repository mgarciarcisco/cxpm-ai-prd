import React, { useState, useEffect, useRef } from 'react';
import { useBlocker } from 'react-router-dom';
import Breadcrumbs from '../../components/common/Breadcrumbs';
import Modal from '../../components/common/Modal';
import { generateJiraEpic, saveJiraStories, listJiraStories, deleteJiraStories, get } from '../../services/api';
import './JiraEpicPage.css';

function JiraEpicPage() {
  const [error, setError] = useState(null);
  const [epics, setEpics] = useState([]);
  const [selectedEpic, setSelectedEpic] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [epicsLoadedFromDB, setEpicsLoadedFromDB] = useState(false);
  const [loadingExistingEpics, setLoadingExistingEpics] = useState(false);
  const [showReplaceConfirmation, setShowReplaceConfirmation] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [showGenerateSuccess, setShowGenerateSuccess] = useState(false);
  const rowsPerPage = 10;
  
  // Requirements selection state (project is always selected - from localStorage or first active)
  const [showRequirementsSelector, setShowRequirementsSelector] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projects, setProjects] = useState([]);
  const [functionalRequirements, setFunctionalRequirements] = useState([]);
  const [selectedRequirements, setSelectedRequirements] = useState(new Set());
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingRequirements, setLoadingRequirements] = useState(false);

  // Ref for scrolling to epics section
  const epicsDisplayRef = useRef(null);
  // When generation is triggered from the modal, pass content to use after replace confirmation
  const pendingGenerationContentRef = useRef(null);

  // Block navigation when there are unsaved Jira Epics (generated but not saved to DB)
  const hasUnsavedEpics = epics.length > 0 && !epicsLoadedFromDB;
  const blocker = useBlocker(hasUnsavedEpics);

  // Browser tab close/refresh warning when unsaved
  useEffect(() => {
    if (!hasUnsavedEpics) return;
    const handleBeforeUnload = (e) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedEpics]);

  // Breadcrumb items: include Project View link when we have a project (e.g. opened from Project View)
  const breadcrumbItems = selectedProject
    ? [
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Project View', href: `/projects/${selectedProject.id}` },
        { label: 'Jira Epics' },
      ]
    : [
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Jira Epics' },
      ];

  // On mount: load selected project (from localStorage or first active) so existing Jira Epics can be shown
  useEffect(() => {
    const initProject = async () => {
      const savedProject = localStorage.getItem('jiraEpic_selectedProject');
      if (savedProject) {
        try {
          const project = JSON.parse(savedProject);
          setSelectedProject(project);
          return;
        } catch (err) {
          console.error('Failed to load saved project:', err);
          localStorage.removeItem('jiraEpic_selectedProject');
        }
      }
      // No saved project: fetch and use first active project so we can show its existing epics if any
      try {
        const projectsData = await get('/api/projects');
        const activeProjects = (projectsData || [])
          .filter((p) => !p.archived)
          .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
        if (activeProjects.length > 0) {
          const project = activeProjects[0];
          setSelectedProject(project);
          setProjects(activeProjects);
          localStorage.setItem('jiraEpic_selectedProject', JSON.stringify(project));
        }
      } catch (err) {
        console.error('Failed to load projects on init:', err);
      }
    };
    initProject();
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

  // Fetch projects list; returns active projects (for use when auto-selecting)
  const fetchProjects = async () => {
    try {
      setLoadingProjects(true);
      const projectsData = await get('/api/projects');
      const activeProjects = projectsData
        .filter(p => !p.archived)
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
      setProjects(activeProjects);
      return activeProjects;
    } catch (err) {
      setError('Failed to load projects: ' + err.message);
      return [];
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

  // Handle Add Requirements button: assume project is always selected; go straight to Select Requirements
  const handleAddFunctionalRequirements = async () => {
    setError(null);

    let project = selectedProject;
    if (!project) {
      const activeProjects = await fetchProjects();
      if (activeProjects.length > 0) {
        project = activeProjects[0];
        setSelectedProject(project);
        localStorage.setItem('jiraEpic_selectedProject', JSON.stringify(project));
      } else {
        setError('No projects found. Create a project first.');
        return;
      }
    }

    if (project?.id) {
      await fetchFunctionalRequirements(project.id);
      setShowRequirementsSelector(true);
    }
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

  // Handle Create Jira Epics button in requirements selector: generate Jira Epics from selected requirements (no textarea)
  const handleApplyRequirements = async () => {
    const selectedReqs = functionalRequirements.filter(req => selectedRequirements.has(req.id));

    if (selectedReqs.length === 0) {
      setError('Please select at least one requirement');
      return;
    }

    const requirementsText = selectedReqs
      .map((req, index) => `${index + 1}. ${req.content}`)
      .join('\n\n');

    const fullText = `--- Functional Requirements from ${selectedProject.name} ---\n\n${requirementsText}`;
    setShowRequirementsSelector(false);
    setError(null);

    if (epics.length > 0) {
      pendingGenerationContentRef.current = fullText;
      setShowReplaceConfirmation(true);
    } else {
      await performGeneration(fullText);
    }
  };


  const performGeneration = async (content) => {
    setEpics([]);
    setSelectedEpic(null);
    setCurrentPage(1);
    setError(null);
    setEpicsLoadedFromDB(false);

    const combinedContent = (content ?? '').trim();
    if (!combinedContent) {
      setError('Please add project functional requirements to continue.');
      return;
    }

    setIsGenerating(true);

    try {
      
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
        throw new Error('No valid Jira Epics were generated. Please check your requirements file.');
      }
      
      setEpics(generatedEpics);
      setSelectedEpic(generatedEpics[0]);

      // Save to database right after generation (selectedProject is set from modal/init flow)
      const project = selectedProject;
      if (project?.id) {
        try {
          const epicData = generatedEpics.map(epic => ({
            title: epic.title || epic.name || 'Untitled Epic',
            description: epic.description || null,
            problem_statement: epic.problemStatement || null,
            target_user_roles: epic.targetUserRoles || null,
            data_sources: epic.dataSources || null,
            business_rules: epic.businessRules || null,
            response_example: epic.responseExample || null,
            acceptance_criteria: epic.acceptanceCriteria || null,
            reporter: null,
            notes: null,
            parent_jira_id: null,
          }));
          const saveResponse = await saveJiraStories(project.id, epicData);
          setEpicsLoadedFromDB(true);
          setSavedCount(saveResponse.saved_count);
        } catch (saveErr) {
          setError(`Failed to save Jira Epics: ${saveErr.message}`);
          // Epics remain visible; epicsLoadedFromDB stays false so user is warned if they leave
        }
      }

      setShowGenerateSuccess(true);
      setTimeout(() => setShowGenerateSuccess(false), 4000);
      setTimeout(() => {
        if (epicsDisplayRef.current) {
          epicsDisplayRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } catch (err) {
      // Ensure epics are cleared on error (safety measure)
      setEpics([]);
      setSelectedEpic(null);
      
      // Handle different error types
      const errorMessage = err.message || 'Failed to generate Jira Epics';
      
      if (errorMessage.includes('503') || errorMessage.includes('unavailable')) {
        setError('LLM service is not available. Please ensure Ollama is running and try again.');
      } else if (errorMessage.includes('400')) {
        setError('Invalid requirements. Please check your file content and try again.');
      } else {
        setError(`Failed to generate Jira Epics: ${errorMessage}`);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirmReplace = async () => {
    setShowReplaceConfirmation(false);
    const contentToUse = pendingGenerationContentRef.current ?? '';
    pendingGenerationContentRef.current = null;
    if (!contentToUse.trim()) return;

    // Delete existing stories if they were loaded from database
    if (epicsLoadedFromDB && selectedProject) {
      try {
        await deleteJiraStories(selectedProject.id);
        console.log('Deleted existing JIRA stories from database');
      } catch (err) {
        console.error('Error deleting existing stories:', err);
        setError('Failed to delete existing Jira Epics. Please try again.');
        return;
      }
    }

    await performGeneration(contentToUse);
  };

  const handleCancelReplace = () => {
    setShowReplaceConfirmation(false);
    pendingGenerationContentRef.current = null;
  };

  const handleLeaveCancel = () => {
    if (blocker.state === 'blocked') blocker.reset();
  };

  const handleLeaveConfirm = () => {
    if (blocker.state === 'blocked') blocker.proceed();
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
      {/* Loading overlay when Jira Epics are being created */}
      {isGenerating && (
        <div className="jira-epic-loading-overlay" aria-live="polite" aria-busy="true">
          <div className="jira-epic-loading-card">
            <div className="jira-epic-loading-spinner" aria-hidden="true" />
            <h3 className="jira-epic-loading-title">Creating Jira Epics</h3>
            <p className="jira-epic-loading-message">This may take a few minutes. Please wait…</p>
          </div>
        </div>
      )}

      <Breadcrumbs items={breadcrumbItems} />

      <section className="upload-section">
        {/* Page Header */}
        <div className="upload-header">
          <h1>Jira Epics{selectedProject ? `: ${selectedProject.name}` : ''}</h1>
          <p className="upload-header__subtitle">
            Generate actionable Jira Epics from your requirements
          </p>
        </div>

        {/* Add Requirements button - right above Jira Epics table */}
        <div className="add-requirements-row">
          <div className="add-requirements-row__inner">
            <button
              type="button"
              className="form-btn form-btn--icon-only add-requirements-btn"
              onClick={handleAddFunctionalRequirements}
              disabled={isGenerating}
              title="Add Functional Requirements"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Empty state when no Jira Epics exist */}
        {!loadingExistingEpics && epics.length === 0 && (
          <div className="jira-epic-empty-state" aria-live="polite">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/>
              <rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
            <p className="jira-epic-empty-state__title">No Jira Epics exist</p>
            <p className="jira-epic-empty-state__text">
              Add functional requirements above, then generate Jira Epics to see them here.
            </p>
          </div>
        )}

        {/* Generated Stories Display - at top */}
        {epics.length > 0 && (
          <>
          <div className="epics-display" ref={epicsDisplayRef}>
            <div className="epics-layout">
              {/* Left Side - Epics Table */}
              <div className="epics-table-container">
                <div className="epics-table-header">
                  <h2>Generated Jira Epics ({epics.length})</h2>
                </div>
                
                <div className="epics-table-wrapper">
                  <table className="epics-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Epic Name</th>
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

                {/* Pagination - show when more epics than fit on one page */}
                {epics.length > rowsPerPage && (
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
                  <h2>{selectedEpic ? selectedEpic.name : 'Select an Epic'}</h2>
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
                      <p>Select an epic from the table to view details</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          </>
        )}

        {/* Success Notification Banner */}
        {showGenerateSuccess && (
          <div className="success-banner">
            <div className="success-banner-content">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <span>Jira Epics successfully generated</span>
            </div>
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
      </section>

      {/* Select Functional Requirements Modal */}
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
                    Create Jira Epics
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
          title="Replace Existing Jira Epics?"
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
              All previous Jira Epics will be completely replaced. 
              {epicsLoadedFromDB && ' Existing epics in the database will be permanently deleted.'}
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
          title="Jira Epics Successfully Created"
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
              {savedCount} Jira Epic{savedCount === 1 ? '' : 's'} successfully saved to the database with unique IDs.
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

      {/* Leave without saving confirmation */}
      {blocker.state === 'blocked' && (
        <Modal
          title="Unsaved changes"
          subtitle="Changes on Jira Epics have not been saved. Are you sure you want to leave?"
          onClose={handleLeaveCancel}
          size="medium"
        >
          <div className="modal-footer">
            <button
              className="form-btn form-btn--secondary"
              onClick={handleLeaveCancel}
              autoFocus
            >
              Cancel
            </button>
            <button
              className="form-btn form-btn--primary"
              onClick={handleLeaveConfirm}
            >
              Confirm
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}

export default JiraEpicPage;
