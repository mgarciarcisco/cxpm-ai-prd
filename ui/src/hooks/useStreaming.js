/**
 * React hook for consuming SSE streams from the meeting extraction endpoint.
 * Handles connection management, error handling, timeouts, and cleanup.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// In production (nginx), use relative URLs which get proxied to backend
// In development, use localhost:8000 directly
const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:8000');
const CONNECTION_TIMEOUT_MS = 120000; // 2 minutes - allows time for slow LLM responses

/**
 * Custom hook for streaming meeting extraction results via SSE
 * @param {string} jobId - The meeting/job ID to stream extraction for
 * @returns {{items: Array, status: string, error: string|null, retry: function}}
 */
export function useStreaming(jobId) {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

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
        setError('Connection timed out. No events received for 2 minutes.');
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
   * Connect to the SSE stream
   */
  const connect = useCallback(() => {
    if (!jobId) return;

    // Reset state
    setItems([]);
    setError(null);
    setStatus('connecting');
    cleanup();

    const url = `${BASE_URL}/api/meetings/${jobId}/stream`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    // Start timeout
    resetTimeout();

    // Handle status event
    eventSource.addEventListener('status', (event) => {
      resetTimeout();
      try {
        const data = JSON.parse(event.data);
        setStatus(data);
      } catch {
        setStatus(event.data);
      }
    });

    // Handle item event
    eventSource.addEventListener('item', (event) => {
      resetTimeout();
      try {
        const data = JSON.parse(event.data);
        setItems((prev) => [...prev, data]);
      } catch (e) {
        console.error('Failed to parse item event:', e);
      }
    });

    // Handle complete event
    eventSource.addEventListener('complete', (event) => {
      resetTimeout();
      try {
        const data = JSON.parse(event.data);
        setStatus('complete');
        // item_count is available in data if needed
        console.log('Extraction complete:', data);
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
          setError(data.message || 'An error occurred during extraction.');
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
        setError('Unable to connect to extraction service. Please check your connection and try again.');
        setStatus('error');
        cleanup();
      }
    };

    // Handle successful open
    eventSource.onopen = () => {
      resetTimeout();
      setStatus('connected');
    };
  }, [jobId, cleanup, resetTimeout]);

  /**
   * Retry function - reconnects to the stream
   */
  const retry = useCallback(() => {
    connect();
  }, [connect]);

  // Connect when jobId changes
  useEffect(() => {
    if (jobId) {
      connect();
    }

    // Cleanup on unmount or jobId change
    return cleanup;
  }, [jobId, connect, cleanup]);

  return { items, status, error, retry };
}

export default useStreaming;
