/**
 * React hook for consuming SSE streams from the PRD generation endpoint.
 * Handles connection management, error handling, timeouts, and cleanup.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// In production (nginx), use relative URLs which get proxied to backend
// In development, use localhost:8000 directly
const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:8000');
const CONNECTION_TIMEOUT_MS = 300000; // 5 minutes - PRD generation can take a while with local LLMs

/**
 * Custom hook for streaming PRD generation results via SSE
 * @param {string} projectId - The project ID to generate PRD for
 * @param {string} mode - The PRD mode ('draft' or 'detailed')
 * @param {boolean} shouldConnect - Whether to start the connection
 * @returns {{title: string|null, sections: Array, status: string, error: string|null, prdId: string|null, retry: function}}
 */
export function usePRDStreaming(projectId, mode, shouldConnect = false) {
  const [title, setTitle] = useState(null);
  const [sections, setSections] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [prdId, setPrdId] = useState(null);
  const [version, setVersion] = useState(null);

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
    setTitle(null);
    setSections([]);
    setError(null);
    setPrdId(null);
    setVersion(null);
  }, []);

  /**
   * Connect to the SSE stream
   */
  const connect = useCallback(() => {
    if (!projectId || !mode) return;

    // Reset state
    resetState();
    setStatus('connecting');
    cleanup();

    const url = `${BASE_URL}/api/projects/${projectId}/prds/stream?mode=${mode}`;
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

    // Handle title event
    eventSource.addEventListener('title', (event) => {
      resetTimeout();
      try {
        const data = JSON.parse(event.data);
        setTitle(data.title);
      } catch (e) {
        console.error('Failed to parse title event:', e);
      }
    });

    // Handle section event
    eventSource.addEventListener('section', (event) => {
      resetTimeout();
      try {
        const data = JSON.parse(event.data);
        setSections((prev) => [...prev, data]);
      } catch (e) {
        console.error('Failed to parse section event:', e);
      }
    });

    // Handle complete event
    eventSource.addEventListener('complete', (event) => {
      resetTimeout();
      try {
        const data = JSON.parse(event.data);
        setPrdId(data.prd_id);
        setVersion(data.version);
        setStatus('complete');
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
      } else {
        setError('Unable to connect to PRD generation service. Please check your connection and try again.');
        setStatus('error');
        cleanup();
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

  // Connect when shouldConnect becomes true
  useEffect(() => {
    if (shouldConnect && projectId && mode) {
      connect();
    }

    // Cleanup on unmount or when shouldConnect becomes false
    return cleanup;
  }, [shouldConnect, projectId, mode, connect, cleanup]);

  return { title, sections, status, error, prdId, version, retry };
}

export default usePRDStreaming;
