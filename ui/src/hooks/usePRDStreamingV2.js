/**
 * React hook for consuming SSE streams from the staged PRD generation endpoint.
 * Handles section-by-section generation with streaming, parallel sections, and per-section status.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// In production (nginx), use relative URLs which get proxied to backend
// In development, use localhost:8000 directly
const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:8000');
const CONNECTION_TIMEOUT_MS = 300000; // 5 minutes - PRD generation can take a while with local LLMs

/**
 * Section status enum
 */
export const SectionStatus = {
  PENDING: 'pending',
  GENERATING: 'generating',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

/**
 * Custom hook for streaming staged PRD generation results via SSE
 *
 * @param {string} projectId - The project ID to generate PRD for
 * @param {string} mode - The PRD mode ('draft' or 'detailed')
 * @param {boolean} shouldConnect - Whether to start the connection
 * @returns {Object} Hook state and controls
 */
export function usePRDStreamingV2(projectId, mode, shouldConnect = false) {
  // Section state - keyed by section_id
  const [sections, setSections] = useState({});

  // Stage tracking
  const [currentStage, setCurrentStage] = useState(null);
  const [streamingSection, setStreamingSection] = useState(null);

  // Overall status
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  // PRD result
  const [prdId, setPrdId] = useState(null);
  const [version, setVersion] = useState(null);
  const [sectionCount, setSectionCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  const eventSourceRef = useRef(null);
  const timeoutRef = useRef(null);

  /**
   * Reset timeout - called whenever an event is received
   */
  const resetTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        setError('Connection timed out. No events received for 5 minutes.');
        setStatus('error');
      }
    }, CONNECTION_TIMEOUT_MS);
  }, []);

  /**
   * Cleanup function - closes EventSource and clears timeout
   */
  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  /**
   * Reset state for a new connection
   */
  const resetState = useCallback(() => {
    setSections({});
    setCurrentStage(null);
    setStreamingSection(null);
    setError(null);
    setPrdId(null);
    setVersion(null);
    setSectionCount(0);
    setFailedCount(0);
  }, []);

  /**
   * Connect to the SSE stream
   */
  const connect = useCallback(() => {
    console.log('[PRD Streaming] connect() called', { projectId, mode, BASE_URL });
    if (!projectId || !mode) {
      console.log('[PRD Streaming] Missing projectId or mode, returning early');
      return;
    }

    // Reset state
    resetState();
    setStatus('connecting');
    cleanup();

    const url = `${BASE_URL}/api/projects/${projectId}/prds/stream?mode=${mode}`;
    console.log('[PRD Streaming] Creating EventSource:', url);
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    // Start timeout
    resetTimeout();

    // Handle status event
    eventSource.addEventListener('status', (event) => {
      resetTimeout();
      try {
        const data = JSON.parse(event.data);
        setStatus(data.status || 'generating');
      } catch {
        setStatus('generating');
      }
    });

    // Handle stage event - new stage starting
    eventSource.addEventListener('stage', (event) => {
      resetTimeout();
      try {
        const data = JSON.parse(event.data);
        setCurrentStage(data.stage);

        // Initialize pending sections for this stage
        setSections((prev) => {
          const updated = { ...prev };
          data.sections.forEach((sectionId) => {
            if (!updated[sectionId]) {
              updated[sectionId] = {
                id: sectionId,
                status: SectionStatus.PENDING,
                content: '',
                title: '',
                order: 0,
              };
            }
          });
          return updated;
        });
      } catch (e) {
        console.error('Failed to parse stage event:', e);
      }
    });

    // Handle chunk event - streaming content for a section
    eventSource.addEventListener('chunk', (event) => {
      resetTimeout();
      try {
        const data = JSON.parse(event.data);
        const { section_id, content } = data;

        setStreamingSection(section_id);
        setSections((prev) => ({
          ...prev,
          [section_id]: {
            ...prev[section_id],
            id: section_id,
            status: SectionStatus.GENERATING,
            content: (prev[section_id]?.content || '') + content,
          },
        }));
      } catch (e) {
        console.error('Failed to parse chunk event:', e);
      }
    });

    // Handle section_complete event
    eventSource.addEventListener('section_complete', (event) => {
      resetTimeout();
      try {
        const data = JSON.parse(event.data);
        const { section_id, title, content, order } = data;

        // Clear streaming section if this was it
        setStreamingSection((prev) => prev === section_id ? null : prev);

        setSections((prev) => ({
          ...prev,
          [section_id]: {
            id: section_id,
            status: SectionStatus.COMPLETED,
            content,
            title,
            order,
          },
        }));
      } catch (e) {
        console.error('Failed to parse section_complete event:', e);
      }
    });

    // Handle section_failed event
    eventSource.addEventListener('section_failed', (event) => {
      resetTimeout();
      try {
        const data = JSON.parse(event.data);
        const { section_id, error: sectionError } = data;

        // Clear streaming section if this was it
        setStreamingSection((prev) => prev === section_id ? null : prev);

        setSections((prev) => ({
          ...prev,
          [section_id]: {
            ...prev[section_id],
            id: section_id,
            status: SectionStatus.FAILED,
            error: sectionError,
          },
        }));
      } catch (e) {
        console.error('Failed to parse section_failed event:', e);
      }
    });

    // Handle complete event
    eventSource.addEventListener('complete', (event) => {
      resetTimeout();
      try {
        const data = JSON.parse(event.data);
        setPrdId(data.prd_id);
        setVersion(data.version);
        setSectionCount(data.section_count);
        setFailedCount(data.failed_count || 0);
        setStatus(data.failed_count > 0 ? 'partial' : 'complete');
        setCurrentStage(null);
        setStreamingSection(null);
        console.log('PRD generation complete:', data);
      } catch {
        setStatus('complete');
      }
      cleanup();
    });

    // Handle error event from server
    eventSource.addEventListener('error', (event) => {
      resetTimeout();
      // Check if this is a server-sent error event with data
      if (event.data) {
        try {
          const data = JSON.parse(event.data);
          setError(data.message || 'An error occurred during PRD generation.');
        } catch {
          setError(event.data);
        }
        setStatus('error');
        cleanup();
      }
    });

    // Handle EventSource connection error
    eventSource.onerror = () => {
      // EventSource reconnects automatically on error, but we want to handle it gracefully
      if (eventSource.readyState === EventSource.CLOSED) {
        setError('Connection to server lost. Please try again.');
        setStatus('error');
        cleanup();
      } else if (eventSource.readyState === EventSource.CONNECTING) {
        // Still trying to reconnect, give it a chance
        // The timeout will catch if it takes too long
        resetTimeout();
      } else if (eventSource.readyState === EventSource.OPEN) {
        // Transient error while connection is open - reset timeout and continue
        resetTimeout();
      }
    };

    // Handle successful open
    eventSource.onopen = () => {
      resetTimeout();
      setStatus('connected');
    };
  }, [projectId, mode, cleanup, resetTimeout, resetState]);

  /**
   * Retry function - reconnects to the stream
   */
  const retry = useCallback(() => {
    connect();
  }, [connect]);

  /**
   * Get sections as sorted array (by order)
   */
  const getSortedSections = useCallback(() => {
    return Object.values(sections).sort((a, b) => a.order - b.order);
  }, [sections]);

  /**
   * Get count of completed sections
   */
  const getCompletedCount = useCallback(() => {
    return Object.values(sections).filter(s => s.status === SectionStatus.COMPLETED).length;
  }, [sections]);

  /**
   * Get total count of sections
   */
  const getTotalCount = useCallback(() => {
    return Object.keys(sections).length;
  }, [sections]);

  // Connect when shouldConnect becomes true
  useEffect(() => {
    console.log('[PRD Streaming] useEffect triggered', { shouldConnect, projectId, mode });
    if (shouldConnect && projectId && mode) {
      console.log('[PRD Streaming] All conditions met, calling connect()');
      connect();
    }

    // Cleanup on unmount or when shouldConnect becomes false
    return cleanup;
  }, [shouldConnect, projectId, mode, connect, cleanup]);

  return {
    // Section data
    sections,
    getSortedSections,

    // Stage tracking
    currentStage,
    streamingSection,

    // Progress
    getCompletedCount,
    getTotalCount,

    // Status
    status,
    error,

    // Result
    prdId,
    version,
    sectionCount,
    failedCount,

    // Controls
    retry,
  };
}

/**
 * Hook for regenerating a single section of an existing PRD
 *
 * @param {string} prdId - The PRD ID
 * @param {string} sectionId - The section ID to regenerate
 */
export function useSectionRegeneration(prdId, sectionId) {
  const [content, setContent] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [affectedSections, setAffectedSections] = useState([]);

  const eventSourceRef = useRef(null);
  const timeoutRef = useRef(null);

  /**
   * Reset timeout - called whenever an event is received
   */
  const resetTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        setError('Regeneration timed out. No response received.');
        setStatus('error');
      }
    }, CONNECTION_TIMEOUT_MS);
  }, []);

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const regenerate = useCallback((customInstructions = null) => {
    if (!prdId || !sectionId) return;

    setContent('');
    setError(null);
    setAffectedSections([]);
    setStatus('regenerating');
    cleanup();

    let url = `${BASE_URL}/api/prds/${prdId}/sections/${sectionId}/regenerate`;
    if (customInstructions) {
      url += `?custom_instructions=${encodeURIComponent(customInstructions)}`;
    }

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    // Start timeout
    resetTimeout();

    // Handle chunk event
    eventSource.addEventListener('chunk', (event) => {
      resetTimeout();
      try {
        const data = JSON.parse(event.data);
        setContent((prev) => prev + data.content);
      } catch (e) {
        console.error('Failed to parse chunk event:', e);
      }
    });

    // Handle section_complete event
    eventSource.addEventListener('section_complete', (event) => {
      resetTimeout();
      try {
        const data = JSON.parse(event.data);
        setContent(data.content);
        setAffectedSections(data.affected_sections || []);
        setStatus('complete');
      } catch (e) {
        console.error('Failed to parse section_complete event:', e);
        setStatus('complete');
      }
      cleanup();
    });

    // Handle error event
    eventSource.addEventListener('error', (event) => {
      resetTimeout();
      if (event.data) {
        try {
          const data = JSON.parse(event.data);
          setError(data.message || 'Regeneration failed.');
        } catch {
          setError(event.data);
        }
        setStatus('error');
        cleanup();
      }
    });

    eventSource.onerror = () => {
      if (eventSource.readyState === EventSource.CLOSED) {
        setError('Connection lost during regeneration.');
        setStatus('error');
        cleanup();
      } else if (eventSource.readyState === EventSource.CONNECTING) {
        // Still trying to reconnect
        resetTimeout();
      }
    };
  }, [prdId, sectionId, cleanup, resetTimeout]);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    content,
    status,
    error,
    affectedSections,
    regenerate,
  };
}

export default usePRDStreamingV2;
