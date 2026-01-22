import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useStreaming } from '../../src/hooks/useStreaming'

// Mock EventSource
class MockEventSource {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSED = 2

  constructor(url) {
    this.url = url
    this.readyState = MockEventSource.CONNECTING
    this.listeners = {}
    this.onopen = null
    this.onerror = null
    MockEventSource.instances.push(this)
  }

  addEventListener(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = []
    }
    this.listeners[event].push(callback)
  }

  removeEventListener(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback)
    }
  }

  dispatchEvent(event) {
    const callbacks = this.listeners[event.type] || []
    callbacks.forEach(cb => cb(event))
  }

  close() {
    this.readyState = MockEventSource.CLOSED
    MockEventSource.closedInstances.push(this)
  }

  // Helper to simulate events
  simulateOpen() {
    this.readyState = MockEventSource.OPEN
    if (this.onopen) {
      this.onopen({ type: 'open' })
    }
  }

  simulateError(data = null) {
    if (data) {
      // Server-sent error event with data
      this.dispatchEvent({ type: 'error', data })
    } else {
      // EventSource connection error
      if (this.onerror) {
        this.onerror({ type: 'error' })
      }
    }
  }

  simulateStatus(data) {
    this.dispatchEvent({
      type: 'status',
      data: typeof data === 'string' ? data : JSON.stringify(data)
    })
  }

  simulateItem(data) {
    this.dispatchEvent({
      type: 'item',
      data: JSON.stringify(data)
    })
  }

  simulateComplete(data) {
    this.dispatchEvent({
      type: 'complete',
      data: JSON.stringify(data)
    })
  }
}

// Static arrays to track instances
MockEventSource.instances = []
MockEventSource.closedInstances = []

// Mock timers
vi.useFakeTimers()

describe('useStreaming', () => {
  let originalEventSource

  beforeEach(() => {
    // Save original EventSource
    originalEventSource = global.EventSource
    // Replace with mock
    global.EventSource = MockEventSource
    // Clear instance tracking
    MockEventSource.instances = []
    MockEventSource.closedInstances = []
    vi.clearAllTimers()
  })

  afterEach(() => {
    // Restore original EventSource
    global.EventSource = originalEventSource
    vi.clearAllMocks()
  })

  describe('Successful stream connection', () => {
    it('connects to the correct URL', () => {
      const { unmount } = renderHook(() => useStreaming('job-123'))

      expect(MockEventSource.instances.length).toBe(1)
      expect(MockEventSource.instances[0].url).toBe('http://localhost:8000/api/meetings/job-123/stream')

      unmount()
    })

    it('sets status to connecting initially', () => {
      const { result, unmount } = renderHook(() => useStreaming('job-123'))

      expect(result.current.status).toBe('connecting')

      unmount()
    })

    it('sets status to connected on open', async () => {
      const { result, unmount } = renderHook(() => useStreaming('job-123'))

      act(() => {
        MockEventSource.instances[0].simulateOpen()
      })

      expect(result.current.status).toBe('connected')

      unmount()
    })

    it('does not connect when jobId is null', () => {
      const { unmount } = renderHook(() => useStreaming(null))

      expect(MockEventSource.instances.length).toBe(0)

      unmount()
    })

    it('does not connect when jobId is empty string', () => {
      const { unmount } = renderHook(() => useStreaming(''))

      expect(MockEventSource.instances.length).toBe(0)

      unmount()
    })
  })

  describe('Item events', () => {
    it('adds items to array as they arrive', async () => {
      const { result, unmount } = renderHook(() => useStreaming('job-123'))

      act(() => {
        MockEventSource.instances[0].simulateOpen()
        MockEventSource.instances[0].simulateItem({
          section: 'problems',
          content: 'First problem',
          source_quote: 'Quote 1'
        })
      })

      expect(result.current.items).toHaveLength(1)
      expect(result.current.items[0].section).toBe('problems')
      expect(result.current.items[0].content).toBe('First problem')

      unmount()
    })

    it('accumulates multiple items', async () => {
      const { result, unmount } = renderHook(() => useStreaming('job-123'))

      act(() => {
        MockEventSource.instances[0].simulateOpen()
        MockEventSource.instances[0].simulateItem({
          section: 'problems',
          content: 'First problem'
        })
        MockEventSource.instances[0].simulateItem({
          section: 'user_goals',
          content: 'A user goal'
        })
        MockEventSource.instances[0].simulateItem({
          section: 'functional_requirements',
          content: 'A requirement'
        })
      })

      expect(result.current.items).toHaveLength(3)
      expect(result.current.items[0].content).toBe('First problem')
      expect(result.current.items[1].content).toBe('A user goal')
      expect(result.current.items[2].content).toBe('A requirement')

      unmount()
    })

    it('handles malformed item JSON gracefully', async () => {
      const { result, unmount } = renderHook(() => useStreaming('job-123'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      act(() => {
        MockEventSource.instances[0].simulateOpen()
        // Send valid item first
        MockEventSource.instances[0].simulateItem({
          section: 'problems',
          content: 'Valid item'
        })
        // Dispatch malformed JSON directly
        MockEventSource.instances[0].dispatchEvent({
          type: 'item',
          data: 'not valid json'
        })
        // Send another valid item
        MockEventSource.instances[0].simulateItem({
          section: 'user_goals',
          content: 'Another valid item'
        })
      })

      // Should have 2 items (malformed one skipped)
      expect(result.current.items).toHaveLength(2)
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
      unmount()
    })
  })

  describe('Error events', () => {
    it('sets error state on server error event', async () => {
      const { result, unmount } = renderHook(() => useStreaming('job-123'))

      act(() => {
        MockEventSource.instances[0].simulateOpen()
        MockEventSource.instances[0].simulateError(JSON.stringify({ message: 'Extraction failed' }))
      })

      expect(result.current.error).toBe('Extraction failed')
      expect(result.current.status).toBe('error')

      unmount()
    })

    it('uses raw error data if not JSON', async () => {
      const { result, unmount } = renderHook(() => useStreaming('job-123'))

      act(() => {
        MockEventSource.instances[0].simulateOpen()
        MockEventSource.instances[0].simulateError('Plain text error')
      })

      expect(result.current.error).toBe('Plain text error')
      expect(result.current.status).toBe('error')

      unmount()
    })

    it('uses default message if error has no message field', async () => {
      const { result, unmount } = renderHook(() => useStreaming('job-123'))

      act(() => {
        MockEventSource.instances[0].simulateOpen()
        MockEventSource.instances[0].simulateError(JSON.stringify({ code: 500 }))
      })

      expect(result.current.error).toBe('An error occurred during extraction.')
      expect(result.current.status).toBe('error')

      unmount()
    })
  })

  describe('EventSource onerror', () => {
    it('sets user-friendly error on connection closed', async () => {
      const { result, unmount } = renderHook(() => useStreaming('job-123'))

      act(() => {
        MockEventSource.instances[0].readyState = MockEventSource.CLOSED
        MockEventSource.instances[0].simulateError()
      })

      expect(result.current.error).toBe('Connection to server lost. Please try again.')
      expect(result.current.status).toBe('error')

      unmount()
    })

    it('sets user-friendly error when not connecting', async () => {
      const { result, unmount } = renderHook(() => useStreaming('job-123'))

      act(() => {
        // Set readyState to OPEN before triggering error
        MockEventSource.instances[0].readyState = MockEventSource.OPEN
        MockEventSource.instances[0].simulateError()
      })

      expect(result.current.error).toBe('Unable to connect to extraction service. Please check your connection and try again.')
      expect(result.current.status).toBe('error')

      unmount()
    })

    it('does not set error when still connecting (reconnecting)', async () => {
      const { result, unmount } = renderHook(() => useStreaming('job-123'))

      act(() => {
        // readyState is CONNECTING (default)
        expect(MockEventSource.instances[0].readyState).toBe(MockEventSource.CONNECTING)
        MockEventSource.instances[0].simulateError()
      })

      // Should not have error yet (still trying to connect)
      expect(result.current.error).toBeNull()
      expect(result.current.status).toBe('connecting')

      unmount()
    })
  })

  describe('Connection timeout', () => {
    it('sets error after 30 seconds with no events', async () => {
      const { result, unmount } = renderHook(() => useStreaming('job-123'))

      // Wait for 30 seconds
      act(() => {
        vi.advanceTimersByTime(30000)
      })

      expect(result.current.error).toBe('Connection timed out. No events received for 30 seconds.')
      expect(result.current.status).toBe('error')

      unmount()
    })

    it('resets timeout when event received', async () => {
      const { result, unmount } = renderHook(() => useStreaming('job-123'))

      // Advance 20 seconds
      act(() => {
        vi.advanceTimersByTime(20000)
      })

      // No timeout yet
      expect(result.current.error).toBeNull()

      // Receive an event
      act(() => {
        MockEventSource.instances[0].simulateOpen()
      })

      // Advance another 20 seconds (40 total from start, but 20 from last event)
      act(() => {
        vi.advanceTimersByTime(20000)
      })

      // Still no timeout (timer was reset)
      expect(result.current.error).toBeNull()

      // Advance 10 more seconds (30 from last event)
      act(() => {
        vi.advanceTimersByTime(10000)
      })

      // Now should timeout
      expect(result.current.error).toBe('Connection timed out. No events received for 30 seconds.')

      unmount()
    })

    it('closes EventSource on timeout', async () => {
      const { unmount } = renderHook(() => useStreaming('job-123'))

      act(() => {
        vi.advanceTimersByTime(30000)
      })

      expect(MockEventSource.closedInstances.length).toBe(1)

      unmount()
    })
  })

  describe('Retry function', () => {
    it('reconnects after error', async () => {
      const { result, unmount } = renderHook(() => useStreaming('job-123'))

      // Simulate error
      act(() => {
        MockEventSource.instances[0].readyState = MockEventSource.CLOSED
        MockEventSource.instances[0].simulateError()
      })

      expect(result.current.status).toBe('error')
      expect(MockEventSource.instances.length).toBe(1)

      // Call retry
      act(() => {
        result.current.retry()
      })

      expect(MockEventSource.instances.length).toBe(2)
      expect(result.current.status).toBe('connecting')
      expect(result.current.error).toBeNull()

      unmount()
    })

    it('resets items array on retry', async () => {
      const { result, unmount } = renderHook(() => useStreaming('job-123'))

      // Add some items
      act(() => {
        MockEventSource.instances[0].simulateOpen()
        MockEventSource.instances[0].simulateItem({
          section: 'problems',
          content: 'Old item'
        })
      })

      expect(result.current.items).toHaveLength(1)

      // Simulate error and retry
      act(() => {
        MockEventSource.instances[0].readyState = MockEventSource.CLOSED
        MockEventSource.instances[0].simulateError()
      })

      act(() => {
        result.current.retry()
      })

      expect(result.current.items).toHaveLength(0)

      unmount()
    })

    it('connects to same URL on retry', async () => {
      const { result, unmount } = renderHook(() => useStreaming('job-123'))

      act(() => {
        result.current.retry()
      })

      expect(MockEventSource.instances.length).toBe(2)
      expect(MockEventSource.instances[1].url).toBe('http://localhost:8000/api/meetings/job-123/stream')

      unmount()
    })
  })

  describe('Cleanup on unmount', () => {
    it('closes EventSource on unmount', () => {
      const { unmount } = renderHook(() => useStreaming('job-123'))

      expect(MockEventSource.closedInstances.length).toBe(0)

      unmount()

      expect(MockEventSource.closedInstances.length).toBe(1)
    })

    it('clears timeout on unmount', () => {
      const { result, unmount } = renderHook(() => useStreaming('job-123'))

      unmount()

      // Advance time after unmount - should not cause any state updates
      act(() => {
        vi.advanceTimersByTime(30000)
      })

      // No error because hook was unmounted and cleaned up
      // (Note: result.current would be stale here, but the point is no errors thrown)
    })

    it('closes EventSource when jobId changes', async () => {
      const { rerender, unmount } = renderHook(({ jobId }) => useStreaming(jobId), {
        initialProps: { jobId: 'job-123' }
      })

      expect(MockEventSource.instances.length).toBe(1)
      expect(MockEventSource.closedInstances.length).toBe(0)

      // Change jobId
      rerender({ jobId: 'job-456' })

      // Old connection closed, new one created
      expect(MockEventSource.closedInstances.length).toBe(1)
      expect(MockEventSource.instances.length).toBe(2)
      expect(MockEventSource.instances[1].url).toBe('http://localhost:8000/api/meetings/job-456/stream')

      unmount()
    })
  })

  describe('Complete event', () => {
    it('sets status to complete', async () => {
      const { result, unmount } = renderHook(() => useStreaming('job-123'))

      act(() => {
        MockEventSource.instances[0].simulateOpen()
        MockEventSource.instances[0].simulateComplete({ item_count: 5 })
      })

      expect(result.current.status).toBe('complete')

      unmount()
    })

    it('closes connection on complete', async () => {
      const { unmount } = renderHook(() => useStreaming('job-123'))

      act(() => {
        MockEventSource.instances[0].simulateOpen()
        MockEventSource.instances[0].simulateComplete({ item_count: 5 })
      })

      expect(MockEventSource.closedInstances.length).toBe(1)

      unmount()
    })

    it('preserves items on complete', async () => {
      const { result, unmount } = renderHook(() => useStreaming('job-123'))

      act(() => {
        MockEventSource.instances[0].simulateOpen()
        MockEventSource.instances[0].simulateItem({
          section: 'problems',
          content: 'A problem'
        })
        MockEventSource.instances[0].simulateItem({
          section: 'user_goals',
          content: 'A goal'
        })
        MockEventSource.instances[0].simulateComplete({ item_count: 2 })
      })

      expect(result.current.items).toHaveLength(2)
      expect(result.current.status).toBe('complete')

      unmount()
    })
  })

  describe('Status events', () => {
    it('updates status from status event', async () => {
      const { result, unmount } = renderHook(() => useStreaming('job-123'))

      act(() => {
        MockEventSource.instances[0].simulateOpen()
        MockEventSource.instances[0].simulateStatus('processing')
      })

      expect(result.current.status).toBe('processing')

      unmount()
    })

    it('handles JSON status data', async () => {
      const { result, unmount } = renderHook(() => useStreaming('job-123'))

      act(() => {
        MockEventSource.instances[0].simulateOpen()
        MockEventSource.instances[0].simulateStatus({ status: 'processing' })
      })

      // When it's JSON, it parses it and sets the parsed object as status
      expect(result.current.status).toEqual({ status: 'processing' })

      unmount()
    })
  })
})
