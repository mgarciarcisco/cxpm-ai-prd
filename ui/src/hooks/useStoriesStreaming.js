/**
 * React hook for consuming SSE streams from the user stories generation endpoint.
 * Handles connection management, error handling, timeouts, and cleanup.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// In production (nginx), use relative URLs which get proxied to backend
// In development, use localhost:8000 directly
const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:8000');
const CONNECTION_TIMEOUT_MS = 300000; // 5 minutes - story generation can take a while with local LLMs

/**
 * Custom hook for streaming user story generation results via SSE
 * @param {string} projectId - The project ID to generate stories for
 * @param {string} format - The story format ('classic' or 'job_story')
 * @param {Array} sectionFilter - Optional array of section IDs to filter by
 * @param {boolean} shouldConnect - Whether to start the connection
 * @returns {{stories: Array, status: string, error: string|null, batchId: string|null, retry: function}}
 */
export function useStoriesStreaming(projectId, format, sectionFilter = [], shouldConnect = false) {
  const [stories, setStories] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [batchId, setBatchId] = useState(null);
  const [storyCount, setStoryCount] = useState(0);

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
    setStories([]);
    setError(null);
    setBatchId(null);
    setStoryCount(0);
  }, []);

  /**
   * Connect to the SSE stream
   */
  const connect = useCallback(() => {
    if (!projectId || !format) return;

    // Reset state
    resetState();
    setStatus('connecting');
    cleanup();

    // Build URL with query parameters
    let url = `${BASE_URL}/api/projects/${projectId}/stories/stream?format=${format}`;
    if (sectionFilter && sectionFilter.length > 0) {
      // Send section_filter as repeated query params (FastAPI list format)
      url += sectionFilter.map(s => `&section_filter=${encodeURIComponent(s)}`).join('');
    }

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

    // Handle story event
    eventSource.addEventListener('story', (event) => {
      resetTimeout();
      try {
        const data = JSON.parse(event.data);
        setStories((prev) => [...prev, data]);
      } catch (e) {
        console.error('Failed to parse story event:', e);
      }
    });

    // Handle complete event
    eventSource.addEventListener('complete', (event) => {
      resetTimeout();
      try {
        const data = JSON.parse(event.data);
        setBatchId(data.batch_id);
        setStoryCount(data.story_count);
        setStatus('complete');
        console.log('Story generation complete:', data);
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
          setError(data.message || 'An error occurred during story generation.');
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
        setError('Unable to connect to story generation service. Please check your connection and try again.');
        setStatus('error');
        cleanup();
      }
    };

    // Handle successful open
    eventSource.onopen = () => {
      resetTimeout();
      setStatus('connected');
    };
  }, [projectId, format, sectionFilter, cleanup, resetTimeout, resetState]);

  /**
   * Retry function - reconnects to the stream
   */
  const retry = useCallback(() => {
    connect();
  }, [connect]);

  // Connect when shouldConnect becomes true
  useEffect(() => {
    if (shouldConnect && projectId && format) {
      connect();
    }

    // Cleanup on unmount or when shouldConnect becomes false
    return cleanup;
  }, [shouldConnect, projectId, format, connect, cleanup]);

  return { stories, status, error, batchId, storyCount, retry };
}

export default useStoriesStreaming;
