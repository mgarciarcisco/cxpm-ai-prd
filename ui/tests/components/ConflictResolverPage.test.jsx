import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ConflictResolverPage from '../../src/pages/ConflictResolverPage'

// Mock the api module
vi.mock('../../src/services/api', () => ({
  get: vi.fn(),
  post: vi.fn()
}))

import { get, post } from '../../src/services/api'

// Mock navigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate
  }
})

describe('ConflictResolverPage', () => {
  const projectId = '123e4567-e89b-12d3-a456-426614174000'
  const meetingId = 'meeting-123'

  const mockMeeting = {
    id: meetingId,
    title: 'Sprint Planning',
    status: 'processed'
  }

  const mockApplyResultsWithItems = {
    added: [
      {
        item_id: 'item-1',
        item_section: 'needs_and_goals',
        item_content: 'New problem to add',
        decision: 'added'
      },
      {
        item_id: 'item-2',
        item_section: 'requirements',
        item_content: 'New user goal',
        decision: 'added'
      }
    ],
    skipped: [
      {
        item_id: 'item-3',
        item_section: 'scope_and_constraints',
        item_content: 'Existing constraint',
        reason: 'Exact duplicate of existing requirement',
        matched_requirement: {
          id: 'req-1',
          content: 'Existing constraint'
        }
      },
      {
        item_id: 'item-4',
        item_section: 'scope_and_constraints',
        item_content: 'Similar constraint',
        reason: 'This is a semantic duplicate',
        matched_requirement: {
          id: 'req-2',
          content: 'Semantically similar constraint'
        }
      }
    ],
    conflicts: [
      {
        item_id: 'item-5',
        item_section: 'requirements',
        item_content: 'Updated feature description with more detail',
        classification: 'refinement',
        reason: 'The new item adds more specific implementation details',
        matched_requirement: {
          id: 'req-3',
          content: 'Feature description'
        }
      },
      {
        item_id: 'item-6',
        item_section: 'risks_and_questions',
        item_content: 'Store data in PostgreSQL',
        classification: 'contradiction',
        reason: 'The new item contradicts the existing storage approach',
        matched_requirement: {
          id: 'req-4',
          content: 'Store data in MongoDB'
        }
      }
    ]
  }

  const mockApplyResultsNoConflicts = {
    added: [
      {
        item_id: 'item-1',
        item_section: 'needs_and_goals',
        item_content: 'New problem',
        decision: 'added'
      }
    ],
    skipped: [],
    conflicts: []
  }

  const mockApplyResultsEmpty = {
    added: [],
    skipped: [],
    conflicts: []
  }

  const renderWithRouter = (ui, { route = `/app/projects/${projectId}/meetings/${meetingId}/apply` } = {}) => {
    return render(
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/app/projects/:id/meetings/:mid/apply" element={ui} />
          <Route path="/app/projects/:id/meetings/:mid" element={<div>Recap Page</div>} />
          <Route path="/app/projects/:id/requirements" element={<div>Requirements Page</div>} />
        </Routes>
      </MemoryRouter>
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockClear()
  })

  describe('Summary Rendering', () => {
    beforeEach(() => {
      get.mockResolvedValue(mockMeeting)
      post.mockImplementation((url) => {
        if (url.includes('/apply')) {
          return Promise.resolve(mockApplyResultsWithItems)
        }
        return Promise.reject(new Error('Unknown endpoint'))
      })
    })

    it('displays meeting title in header', async () => {
      renderWithRouter(<ConflictResolverPage />)

      await waitFor(() => {
        expect(screen.getByText('Apply: Sprint Planning')).toBeInTheDocument()
      })
    })

    it('displays summary counts in footer', async () => {
      renderWithRouter(<ConflictResolverPage />)

      await waitFor(() => {
        expect(screen.getByText(/to add/)).toBeInTheDocument()
      })

      expect(screen.getByText(/skipped/)).toBeInTheDocument()
      expect(screen.getByText(/conflicts resolved/)).toBeInTheDocument()
    })

    it('displays new items when New Items category is selected', async () => {
      renderWithRouter(<ConflictResolverPage />)

      await waitFor(() => {
        expect(screen.getByText('New Items')).toBeInTheDocument()
      })

      // Click on "New Items" category in side nav
      fireEvent.click(screen.getByText('New Items'))

      await waitFor(() => {
        expect(screen.getByText('New problem to add')).toBeInTheDocument()
      })
      expect(screen.getByText('New user goal')).toBeInTheDocument()
    })

    it('displays skipped items when Duplicates category is selected', async () => {
      renderWithRouter(<ConflictResolverPage />)

      await waitFor(() => {
        expect(screen.getByText('Duplicates')).toBeInTheDocument()
      })

      // Click on "Duplicates" category in side nav
      fireEvent.click(screen.getByText('Duplicates'))

      await waitFor(() => {
        expect(screen.getAllByText('Existing constraint').length).toBeGreaterThan(0)
      })

      expect(screen.getByText('Exact duplicate of existing requirement')).toBeInTheDocument()
      const matchLabels = screen.getAllByText('Matches existing:')
      expect(matchLabels.length).toBeGreaterThan(0)
    })

    it('displays section labels in added items', async () => {
      renderWithRouter(<ConflictResolverPage />)

      await waitFor(() => {
        expect(screen.getByText('New Items')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('New Items'))

      await waitFor(() => {
        expect(screen.getByText('Needs & Goals')).toBeInTheDocument()
      })
      expect(screen.getByText('Requirements')).toBeInTheDocument()
    })

    it('shows empty state when all categories are empty', async () => {
      post.mockResolvedValue(mockApplyResultsEmpty)

      renderWithRouter(<ConflictResolverPage />)

      await waitFor(() => {
        expect(screen.getByText('No New Items')).toBeInTheDocument()
      })
    })

    it('displays cancel link', async () => {
      renderWithRouter(<ConflictResolverPage />)

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeInTheDocument()
      })

      const cancelLink = screen.getByText('Cancel')
      expect(cancelLink).toHaveAttribute('href', `/app/projects/${projectId}/meetings/${meetingId}`)
    })
  })

  describe('ConflictCard Option Selection', () => {
    beforeEach(() => {
      get.mockResolvedValue(mockMeeting)
      post.mockImplementation((url) => {
        if (url.includes('/apply')) {
          return Promise.resolve(mockApplyResultsWithItems)
        }
        return Promise.reject(new Error('Unknown endpoint'))
      })
    })

    it('displays conflict cards with classification badges', async () => {
      renderWithRouter(<ConflictResolverPage />)

      await waitFor(() => {
        expect(screen.getByText('Refinement')).toBeInTheDocument()
      })

      expect(screen.getByText('Contradiction')).toBeInTheDocument()
    })

    it('displays existing and new content in conflict card', async () => {
      renderWithRouter(<ConflictResolverPage />)

      await waitFor(() => {
        expect(screen.getByText('Feature description')).toBeInTheDocument()
      })

      expect(screen.getByText('Updated feature description with more detail')).toBeInTheDocument()
    })

    it('displays AI recommendation reason', async () => {
      renderWithRouter(<ConflictResolverPage />)

      await waitFor(() => {
        expect(screen.getByText('The new item adds more specific implementation details')).toBeInTheDocument()
      })
    })

    it('displays resolution options for each conflict', async () => {
      renderWithRouter(<ConflictResolverPage />)

      await waitFor(() => {
        expect(screen.getAllByText('Choose resolution:').length).toBeGreaterThan(0)
      })

      // Check for radio options (multiple conflicts, each has 4 options)
      const keepExistingOptions = screen.getAllByText('Keep existing')
      expect(keepExistingOptions.length).toBe(2) // One per conflict

      const replaceOptions = screen.getAllByText('Replace')
      expect(replaceOptions.length).toBe(2)

      const keepBothOptions = screen.getAllByText('Keep both')
      expect(keepBothOptions.length).toBe(2)

      const mergeOptions = screen.getAllByText('Merge')
      expect(mergeOptions.length).toBe(2)
    })

    it('marks recommended option with badge', async () => {
      renderWithRouter(<ConflictResolverPage />)

      await waitFor(() => {
        expect(screen.getAllByText('Choose resolution:').length).toBeGreaterThan(0)
      })

      // Refinement recommends "Replace", Contradiction recommends "Keep existing"
      const recommendedBadges = screen.getAllByText('Recommended')
      expect(recommendedBadges.length).toBe(2)
    })

    it('allows selecting resolution option', async () => {
      renderWithRouter(<ConflictResolverPage />)

      await waitFor(() => {
        expect(screen.getAllByText('Choose resolution:').length).toBeGreaterThan(0)
      })

      // Select "Keep existing" for first conflict
      const keepExistingOptions = screen.getAllByRole('radio', { name: /keep existing/i })
      fireEvent.click(keepExistingOptions[0])

      expect(keepExistingOptions[0]).toBeChecked()
    })

    it('shows selected state visually on option', async () => {
      renderWithRouter(<ConflictResolverPage />)

      await waitFor(() => {
        expect(screen.getAllByText('Choose resolution:').length).toBeGreaterThan(0)
      })

      // Get the label containing "Keep existing" for first conflict
      const keepExistingOptions = screen.getAllByRole('radio', { name: /keep existing/i })
      fireEvent.click(keepExistingOptions[0])

      // The parent label should have the selected class
      const selectedLabel = keepExistingOptions[0].closest('label')
      expect(selectedLabel).toHaveClass('conflict-card-option--selected')
    })
  })

  describe('BulkActions Button Behavior', () => {
    beforeEach(() => {
      get.mockResolvedValue(mockMeeting)
      post.mockImplementation((url) => {
        if (url.includes('/apply')) {
          return Promise.resolve(mockApplyResultsWithItems)
        }
        return Promise.reject(new Error('Unknown endpoint'))
      })
    })

    it('displays bulk action button when conflicts exist', async () => {
      renderWithRouter(<ConflictResolverPage />)

      await waitFor(() => {
        expect(screen.getByText('Accept AI recommendations')).toBeInTheDocument()
      })
    })

    it('does not display bulk action button when no conflicts', async () => {
      post.mockResolvedValue(mockApplyResultsNoConflicts)

      renderWithRouter(<ConflictResolverPage />)

      await waitFor(() => {
        expect(screen.getByText('New problem')).toBeInTheDocument()
      })

      expect(screen.queryByText('Accept AI recommendations')).not.toBeInTheDocument()
    })

    it('sets all resolutions to AI recommended when bulk action clicked', async () => {
      renderWithRouter(<ConflictResolverPage />)

      await waitFor(() => {
        expect(screen.getByText('Accept AI recommendations')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Accept AI recommendations'))

      // After bulk action, the Apply Changes button should be enabled
      // because all conflicts are resolved
      await waitFor(() => {
        const applyButton = screen.getByRole('button', { name: /apply changes/i })
        expect(applyButton).not.toBeDisabled()
      })

      // Verify resolution count shows all conflicts resolved
      expect(screen.getByText((content, element) => {
        return element.classList?.contains('apply-footer-stat--conflicts') && element.textContent === '2/2 conflicts resolved'
      })).toBeInTheDocument()
    })
  })

  describe('Apply Changes Validation and Submission', () => {
    beforeEach(() => {
      get.mockResolvedValue(mockMeeting)
      post.mockImplementation((url) => {
        if (url.includes('/apply')) {
          return Promise.resolve(mockApplyResultsWithItems)
        }
        if (url.includes('/resolve')) {
          return Promise.resolve({ added: 2, skipped: 2, merged: 0, replaced: 1 })
        }
        return Promise.reject(new Error('Unknown endpoint'))
      })
    })

    it('displays Apply Changes button', async () => {
      renderWithRouter(<ConflictResolverPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /apply changes/i })).toBeInTheDocument()
      })
    })

    it('disables Apply Changes button when conflicts are unresolved', async () => {
      renderWithRouter(<ConflictResolverPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /apply changes/i })).toBeInTheDocument()
      })

      const applyButton = screen.getByRole('button', { name: /apply changes/i })
      expect(applyButton).toBeDisabled()
    })

    it('shows resolution count in footer', async () => {
      renderWithRouter(<ConflictResolverPage />)

      await waitFor(() => {
        expect(screen.getByText((content, element) => {
          return element.classList?.contains('apply-footer-stat--conflicts') && element.textContent === '0/2 conflicts resolved'
        })).toBeInTheDocument()
      })
    })

    it('enables Apply Changes button when all conflicts resolved', async () => {
      renderWithRouter(<ConflictResolverPage />)

      await waitFor(() => {
        expect(screen.getByText('Accept AI recommendations')).toBeInTheDocument()
      })

      // Resolve all conflicts using bulk action
      fireEvent.click(screen.getByText('Accept AI recommendations'))

      await waitFor(() => {
        const applyButton = screen.getByRole('button', { name: /apply changes/i })
        expect(applyButton).not.toBeDisabled()
      })
    })

    it('calls resolve endpoint with correct decisions when Apply Changes clicked', async () => {
      renderWithRouter(<ConflictResolverPage />)

      await waitFor(() => {
        expect(screen.getByText('Accept AI recommendations')).toBeInTheDocument()
      })

      // Resolve all conflicts
      fireEvent.click(screen.getByText('Accept AI recommendations'))

      await waitFor(() => {
        const applyButton = screen.getByRole('button', { name: /apply changes/i })
        expect(applyButton).not.toBeDisabled()
      })

      fireEvent.click(screen.getByRole('button', { name: /apply changes/i }))

      // Wait for the success message to verify API was called
      await waitFor(() => {
        expect(screen.getByText('Changes applied successfully! Redirecting to requirements...')).toBeInTheDocument()
      })

      // Verify the resolve endpoint was called
      const resolveCalls = post.mock.calls.filter(call => call[0].includes('/resolve'))
      expect(resolveCalls.length).toBe(1)

      const decisionsPayload = resolveCalls[0][1].decisions

      // Verify added items
      expect(decisionsPayload).toContainEqual(expect.objectContaining({ item_id: 'item-1', decision: 'added' }))
      expect(decisionsPayload).toContainEqual(expect.objectContaining({ item_id: 'item-2', decision: 'added' }))

      // Verify skipped items
      expect(decisionsPayload).toContainEqual(expect.objectContaining({ item_id: 'item-3', decision: 'skipped_duplicate' }))
      expect(decisionsPayload).toContainEqual(expect.objectContaining({ item_id: 'item-4', decision: 'skipped_semantic' }))

      // Verify conflict resolutions (refinement -> replace, contradiction -> keep_existing)
      expect(decisionsPayload).toContainEqual(expect.objectContaining({ item_id: 'item-5', decision: 'conflict_replaced' }))
      expect(decisionsPayload).toContainEqual(expect.objectContaining({ item_id: 'item-6', decision: 'conflict_keep_existing' }))
    })

    it('shows loading state while applying', async () => {
      post.mockImplementation((url) => {
        if (url.includes('/apply')) {
          return Promise.resolve(mockApplyResultsWithItems)
        }
        if (url.includes('/resolve')) {
          return new Promise(() => {}) // Never resolves
        }
        return Promise.reject(new Error('Unknown endpoint'))
      })

      renderWithRouter(<ConflictResolverPage />)

      await waitFor(() => {
        expect(screen.getByText('Accept AI recommendations')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Accept AI recommendations'))

      await waitFor(() => {
        const applyButton = screen.getByRole('button', { name: /apply changes/i })
        expect(applyButton).not.toBeDisabled()
      })

      fireEvent.click(screen.getByRole('button', { name: /apply changes/i }))

      await waitFor(() => {
        expect(screen.getByText('Applying...')).toBeInTheDocument()
      })
    })

    it('shows success message after successful apply', async () => {
      renderWithRouter(<ConflictResolverPage />)

      await waitFor(() => {
        expect(screen.getByText('Accept AI recommendations')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Accept AI recommendations'))

      await waitFor(() => {
        const applyButton = screen.getByRole('button', { name: /apply changes/i })
        expect(applyButton).not.toBeDisabled()
      })

      fireEvent.click(screen.getByRole('button', { name: /apply changes/i }))

      await waitFor(() => {
        expect(screen.getByText('Changes applied successfully! Redirecting to requirements...')).toBeInTheDocument()
      })
    })

    it('navigates to requirements page after successful apply', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })

      renderWithRouter(<ConflictResolverPage />)

      await vi.waitFor(() => {
        expect(screen.getByText('Accept AI recommendations')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Accept AI recommendations'))

      await vi.waitFor(() => {
        const applyButton = screen.getByRole('button', { name: /apply changes/i })
        expect(applyButton).not.toBeDisabled()
      })

      fireEvent.click(screen.getByRole('button', { name: /apply changes/i }))

      await vi.waitFor(() => {
        expect(screen.getByText('Changes applied successfully! Redirecting to requirements...')).toBeInTheDocument()
      })

      // Advance timer to trigger navigation
      await vi.advanceTimersByTimeAsync(1500)

      expect(mockNavigate).toHaveBeenCalledWith(`/projects/${projectId}/requirements`)

      vi.useRealTimers()
    })

    it('shows error message when apply fails', async () => {
      get.mockResolvedValue(mockMeeting)
      post.mockImplementation((url) => {
        if (url.includes('/apply')) {
          return Promise.resolve(mockApplyResultsWithItems)
        }
        if (url.includes('/resolve')) {
          return Promise.reject(new Error('Server error'))
        }
        return Promise.reject(new Error('Unknown endpoint'))
      })

      renderWithRouter(<ConflictResolverPage />)

      await waitFor(() => {
        expect(screen.getByText('Accept AI recommendations')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Accept AI recommendations'))

      await waitFor(() => {
        const applyButton = screen.getByRole('button', { name: /apply changes/i })
        expect(applyButton).not.toBeDisabled()
      })

      fireEvent.click(screen.getByRole('button', { name: /apply changes/i }))

      await waitFor(() => {
        expect(screen.getByText('Failed to apply changes: Server error')).toBeInTheDocument()
      })
    })

    it('provides retry button when apply fails', async () => {
      get.mockResolvedValue(mockMeeting)
      let callCount = 0
      post.mockImplementation((url) => {
        if (url.includes('/apply')) {
          return Promise.resolve(mockApplyResultsWithItems)
        }
        if (url.includes('/resolve')) {
          callCount++
          if (callCount === 1) {
            return Promise.reject(new Error('Server error'))
          }
          return Promise.resolve({ added: 2, skipped: 2, merged: 0, replaced: 1 })
        }
        return Promise.reject(new Error('Unknown endpoint'))
      })

      renderWithRouter(<ConflictResolverPage />)

      await waitFor(() => {
        expect(screen.getByText('Accept AI recommendations')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Accept AI recommendations'))

      await waitFor(() => {
        const applyButton = screen.getByRole('button', { name: /apply changes/i })
        expect(applyButton).not.toBeDisabled()
      })

      fireEvent.click(screen.getByRole('button', { name: /apply changes/i }))

      await waitFor(() => {
        expect(screen.getByText('Failed to apply changes: Server error')).toBeInTheDocument()
      })

      // Click retry
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

      await waitFor(() => {
        expect(screen.getByText('Changes applied successfully! Redirecting to requirements...')).toBeInTheDocument()
      })
    })
  })

  describe('Loading State', () => {
    it('shows loading spinner while fetching', async () => {
      get.mockImplementation(() => new Promise(() => {})) // Never resolves
      post.mockImplementation(() => new Promise(() => {})) // Never resolves

      renderWithRouter(<ConflictResolverPage />)

      expect(screen.getByText('Analyzing meeting items...')).toBeInTheDocument()
    })
  })

  describe('Error State', () => {
    beforeEach(() => {
      get.mockRejectedValue(new Error('Network error'))
      post.mockRejectedValue(new Error('Network error'))
    })

    it('displays error message when fetch fails', async () => {
      renderWithRouter(<ConflictResolverPage />)

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })
    })

    it('shows retry button on error', async () => {
      renderWithRouter(<ConflictResolverPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument()
      })
    })

    it('retries fetching when retry button is clicked', async () => {
      get.mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue(mockMeeting)
      post.mockResolvedValue(mockApplyResultsWithItems)

      renderWithRouter(<ConflictResolverPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: 'Try Again' }))

      await waitFor(() => {
        expect(screen.getByText('Apply: Sprint Planning')).toBeInTheDocument()
      })
    })
  })

  describe('No Conflicts Scenario', () => {
    beforeEach(() => {
      get.mockResolvedValue(mockMeeting)
      post.mockImplementation((url) => {
        if (url.includes('/apply')) {
          return Promise.resolve(mockApplyResultsNoConflicts)
        }
        if (url.includes('/resolve')) {
          return Promise.resolve({ added: 1, skipped: 0, merged: 0, replaced: 0 })
        }
        return Promise.reject(new Error('Unknown endpoint'))
      })
    })

    it('enables Apply Changes button immediately when no conflicts', async () => {
      renderWithRouter(<ConflictResolverPage />)

      await waitFor(() => {
        expect(screen.getByText('New problem')).toBeInTheDocument()
      })

      const applyButton = screen.getByRole('button', { name: /apply changes/i })
      expect(applyButton).not.toBeDisabled()
    })

    it('does not show Conflicts section when no conflicts', async () => {
      renderWithRouter(<ConflictResolverPage />)

      await waitFor(() => {
        expect(screen.getByText('New problem')).toBeInTheDocument()
      })

      expect(screen.queryByText('Choose resolution:')).not.toBeInTheDocument()
    })

    it('does not show conflict count in footer when no conflicts', async () => {
      renderWithRouter(<ConflictResolverPage />)

      await waitFor(() => {
        expect(screen.getByText('New problem')).toBeInTheDocument()
      })

      expect(screen.queryByText(/conflicts resolved/)).not.toBeInTheDocument()
    })
  })
})
