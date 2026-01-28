import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter, MemoryRouter, Route, Routes } from 'react-router-dom'
import RequirementsPage from '../../src/pages/RequirementsPage'

// Mock the api module
vi.mock('../../src/services/api', () => ({
  get: vi.fn(),
  put: vi.fn(),
  del: vi.fn()
}))

import { get, put, del } from '../../src/services/api'

// Mock fetch for export functionality
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:test-url')
global.URL.revokeObjectURL = vi.fn()

describe('RequirementsPage', () => {
  const projectId = '123e4567-e89b-12d3-a456-426614174000'

  const mockProject = {
    id: projectId,
    name: 'Test Project',
    description: 'A test project'
  }

  const mockRequirements = {
    problems: [
      {
        id: 'req-1',
        section: 'problems',
        content: 'Problem requirement 1',
        order: 1,
        sources: [
          { id: 'src-1', meeting_id: 'meeting-1', meeting_title: 'Sprint Planning' }
        ],
        history_count: 2
      },
      {
        id: 'req-2',
        section: 'problems',
        content: 'Problem requirement 2',
        order: 2,
        sources: [],
        history_count: 0
      }
    ],
    user_goals: [
      {
        id: 'req-3',
        section: 'user_goals',
        content: 'User goal 1',
        order: 1,
        sources: [
          { id: 'src-2', meeting_id: 'meeting-1', meeting_title: 'Sprint Planning' },
          { id: 'src-3', meeting_id: 'meeting-2', meeting_title: 'Requirements Review' }
        ],
        history_count: 1
      }
    ],
    functional_requirements: [],
    data_needs: [],
    constraints: [],
    non_goals: [],
    risks_assumptions: [],
    open_questions: [],
    action_items: []
  }

  const renderWithRouter = (ui, { route = `/app/projects/${projectId}/requirements` } = {}) => {
    return render(
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/app/projects/:id/requirements" element={ui} />
          <Route path="/app/projects/:id/meetings/:mid" element={<div>Meeting Page</div>} />
          <Route path="/app/projects/:id" element={<div>Project Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
    get.mockImplementation((url) => {
      if (url.includes('/requirements')) {
        return Promise.resolve(mockRequirements)
      }
      if (url.includes('/projects/')) {
        return Promise.resolve(mockProject)
      }
      return Promise.reject(new Error('Unknown endpoint'))
    })
  })

  describe('Section Rendering', () => {
    it('renders all 9 sections', async () => {
      renderWithRouter(<RequirementsPage />)

      await waitFor(() => {
        expect(screen.getByText('Problems')).toBeInTheDocument()
      })

      expect(screen.getByText('User Goals')).toBeInTheDocument()
      expect(screen.getByText('Functional Requirements')).toBeInTheDocument()
      expect(screen.getByText('Data Needs')).toBeInTheDocument()
      expect(screen.getByText('Constraints')).toBeInTheDocument()
      expect(screen.getByText('Non-Goals')).toBeInTheDocument()
      expect(screen.getByText('Risks & Assumptions')).toBeInTheDocument()
      expect(screen.getByText('Open Questions')).toBeInTheDocument()
      expect(screen.getByText('Action Items')).toBeInTheDocument()
    })

    it('displays requirements within correct sections', async () => {
      renderWithRouter(<RequirementsPage />)

      await waitFor(() => {
        expect(screen.getByText('Problem requirement 1')).toBeInTheDocument()
      })

      expect(screen.getByText('Problem requirement 2')).toBeInTheDocument()
      expect(screen.getByText('User goal 1')).toBeInTheDocument()
    })

    it('shows empty message for sections with no requirements', async () => {
      renderWithRouter(<RequirementsPage />)

      await waitFor(() => {
        expect(screen.getByText('Problem requirement 1')).toBeInTheDocument()
      })

      // 7 sections should be empty (all except problems and user_goals)
      const emptyMessages = screen.getAllByText('No requirements in this section')
      expect(emptyMessages.length).toBe(7)
    })

    it('displays item count in section headers', async () => {
      renderWithRouter(<RequirementsPage />)

      await waitFor(() => {
        expect(screen.getByText('Problem requirement 1')).toBeInTheDocument()
      })

      // Problems has 2 items
      const problemsSection = screen.getByText('Problems').closest('.collapsible-section')
      expect(problemsSection).toHaveTextContent('2')

      // User Goals has 1 item
      const goalsSection = screen.getByText('User Goals').closest('.collapsible-section')
      expect(goalsSection).toHaveTextContent('1')
    })

    it('displays project name in header', async () => {
      renderWithRouter(<RequirementsPage />)

      await waitFor(() => {
        expect(screen.getByText('Test Project - Requirements')).toBeInTheDocument()
      })
    })
  })

  describe('Loading State', () => {
    it('shows loading spinner while fetching', async () => {
      get.mockImplementation(() => new Promise(() => {})) // Never resolves

      renderWithRouter(<RequirementsPage />)

      expect(screen.getByText('Loading requirements...')).toBeInTheDocument()
    })
  })

  describe('Error State', () => {
    it('displays error message when fetch fails', async () => {
      get.mockRejectedValue(new Error('Network error'))

      renderWithRouter(<RequirementsPage />)

      await waitFor(() => {
        expect(screen.getByText('Error loading requirements: Network error')).toBeInTheDocument()
      })
    })

    it('shows retry button on error', async () => {
      get.mockRejectedValue(new Error('Network error'))

      renderWithRouter(<RequirementsPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
      })
    })

    it('retries fetching when retry button is clicked', async () => {
      get.mockRejectedValueOnce(new Error('Network error'))
        .mockImplementation((url) => {
          if (url.includes('/requirements')) {
            return Promise.resolve(mockRequirements)
          }
          return Promise.resolve(mockProject)
        })

      renderWithRouter(<RequirementsPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

      await waitFor(() => {
        expect(screen.getByText('Problem requirement 1')).toBeInTheDocument()
      })
    })
  })

  describe('Inline Edit Interaction', () => {
    it('allows inline editing of requirements via ItemRow', async () => {
      const updatedRequirement = { ...mockRequirements.problems[0], content: 'Updated problem' }
      put.mockResolvedValue(updatedRequirement)

      renderWithRouter(<RequirementsPage />)

      await waitFor(() => {
        expect(screen.getByText('Problem requirement 1')).toBeInTheDocument()
      })

      // Click edit button on first requirement
      const editButtons = screen.getAllByLabelText('Edit item')
      fireEvent.click(editButtons[0])

      // Change content
      const textarea = screen.getByDisplayValue('Problem requirement 1')
      fireEvent.change(textarea, { target: { value: 'Updated problem' } })

      // Save
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      await waitFor(() => {
        expect(put).toHaveBeenCalledWith('/api/requirements/req-1', {
          content: 'Updated problem'
        })
      })
    })

    it('updates local state after successful edit', async () => {
      const updatedRequirement = { ...mockRequirements.problems[0], content: 'Updated problem' }
      put.mockResolvedValue(updatedRequirement)

      renderWithRouter(<RequirementsPage />)

      await waitFor(() => {
        expect(screen.getByText('Problem requirement 1')).toBeInTheDocument()
      })

      // Click edit button
      const editButtons = screen.getAllByLabelText('Edit item')
      fireEvent.click(editButtons[0])

      // Change and save
      const textarea = screen.getByDisplayValue('Problem requirement 1')
      fireEvent.change(textarea, { target: { value: 'Updated problem' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      await waitFor(() => {
        expect(screen.getByText('Updated problem')).toBeInTheDocument()
      })
    })
  })

  describe('Delete Confirmation', () => {
    it('shows confirmation dialog before deleting', async () => {
      renderWithRouter(<RequirementsPage />)

      await waitFor(() => {
        expect(screen.getByText('Problem requirement 1')).toBeInTheDocument()
      })

      // Click delete button
      const deleteButtons = screen.getAllByLabelText('Delete item')
      fireEvent.click(deleteButtons[0])

      expect(screen.getByText('Delete this item?')).toBeInTheDocument()
    })

    it('deletes requirement when confirmed', async () => {
      del.mockResolvedValue()

      renderWithRouter(<RequirementsPage />)

      await waitFor(() => {
        expect(screen.getByText('Problem requirement 1')).toBeInTheDocument()
      })

      // Click delete button
      const deleteButtons = screen.getAllByLabelText('Delete item')
      fireEvent.click(deleteButtons[0])

      // Confirm deletion
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

      await waitFor(() => {
        expect(del).toHaveBeenCalledWith('/api/requirements/req-1')
      })
    })

    it('removes requirement from display after deletion', async () => {
      del.mockResolvedValue()

      renderWithRouter(<RequirementsPage />)

      await waitFor(() => {
        expect(screen.getByText('Problem requirement 1')).toBeInTheDocument()
      })

      // Delete first requirement
      const deleteButtons = screen.getAllByLabelText('Delete item')
      fireEvent.click(deleteButtons[0])
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

      await waitFor(() => {
        expect(screen.queryByText('Problem requirement 1')).not.toBeInTheDocument()
      })

      // Second requirement should still be visible
      expect(screen.getByText('Problem requirement 2')).toBeInTheDocument()
    })

    it('cancels delete when cancel button is clicked', async () => {
      renderWithRouter(<RequirementsPage />)

      await waitFor(() => {
        expect(screen.getByText('Problem requirement 1')).toBeInTheDocument()
      })

      // Click delete button
      const deleteButtons = screen.getAllByLabelText('Delete item')
      fireEvent.click(deleteButtons[0])

      // Cancel
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

      // Requirement should still be visible
      expect(screen.getByText('Problem requirement 1')).toBeInTheDocument()
      expect(del).not.toHaveBeenCalled()
    })
  })

  describe('Source Link Navigation', () => {
    it('displays source meeting links', async () => {
      renderWithRouter(<RequirementsPage />)

      await waitFor(() => {
        expect(screen.getByText('Problem requirement 1')).toBeInTheDocument()
      })

      // Source links should be displayed (Sprint Planning appears in multiple requirements)
      const sprintPlanningLinks = screen.getAllByText('Sprint Planning')
      expect(sprintPlanningLinks.length).toBeGreaterThanOrEqual(1)
    })

    it('displays multiple sources as comma-separated links', async () => {
      renderWithRouter(<RequirementsPage />)

      await waitFor(() => {
        expect(screen.getByText('User goal 1')).toBeInTheDocument()
      })

      // Both source links should be visible
      // User goal 1 has two sources: Sprint Planning and Requirements Review
      const sprintPlanningLinks = screen.getAllByText('Sprint Planning')
      expect(sprintPlanningLinks.length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('Requirements Review')).toBeInTheDocument()
    })

    it('source links have correct href', async () => {
      renderWithRouter(<RequirementsPage />)

      await waitFor(() => {
        expect(screen.getByText('Problem requirement 1')).toBeInTheDocument()
      })

      // Get the source link for the first requirement
      const sourceLink = screen.getAllByText('Sprint Planning')[0].closest('a')
      expect(sourceLink).toHaveAttribute('href', `/app/projects/${projectId}/meetings/meeting-1`)
    })

    it('does not display source section when no sources', async () => {
      renderWithRouter(<RequirementsPage />)

      await waitFor(() => {
        expect(screen.getByText('Problem requirement 2')).toBeInTheDocument()
      })

      // Problem requirement 2 has no sources
      // Its wrapper should not have source links
      const req2Wrapper = screen.getByText('Problem requirement 2').closest('.requirements-item-wrapper')
      expect(req2Wrapper.querySelector('.requirement-sources')).toBeNull()
    })
  })

  describe('Export Button', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob(['# Requirements'], { type: 'text/markdown' }))
      })
    })

    it('displays export button', async () => {
      renderWithRouter(<RequirementsPage />)

      await waitFor(() => {
        expect(screen.getByText('Export as Markdown')).toBeInTheDocument()
      })
    })

    it('calls export endpoint when export button is clicked', async () => {
      renderWithRouter(<RequirementsPage />)

      await waitFor(() => {
        expect(screen.getByText('Export as Markdown')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Export as Markdown'))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(`/api/projects/${projectId}/requirements/export`)
        )
      })
    })

    it('shows "Exporting..." while export is in progress', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {})) // Never resolves

      renderWithRouter(<RequirementsPage />)

      await waitFor(() => {
        expect(screen.getByText('Export as Markdown')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Export as Markdown'))

      await waitFor(() => {
        expect(screen.getByText('Exporting...')).toBeInTheDocument()
      })
    })

    it('disables export button while exporting', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {}))

      renderWithRouter(<RequirementsPage />)

      await waitFor(() => {
        expect(screen.getByText('Export as Markdown')).toBeInTheDocument()
      })

      const exportButton = screen.getByText('Export as Markdown').closest('button')
      fireEvent.click(exportButton)

      await waitFor(() => {
        expect(screen.getByText('Exporting...').closest('button')).toBeDisabled()
      })
    })

    it('triggers file download with correct filename', async () => {
      const appendChildSpy = vi.spyOn(document.body, 'appendChild')
      const removeChildSpy = vi.spyOn(document.body, 'removeChild')

      renderWithRouter(<RequirementsPage />)

      await waitFor(() => {
        expect(screen.getByText('Export as Markdown')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Export as Markdown'))

      await waitFor(() => {
        expect(appendChildSpy).toHaveBeenCalled()
      })

      // Verify the anchor element was created and clicked
      const anchorCall = appendChildSpy.mock.calls.find(call => call[0].tagName === 'A')
      expect(anchorCall).toBeDefined()
      const anchor = anchorCall[0]
      expect(anchor.download).toBe('test-project-requirements.md')
      expect(anchor.href).toBe('blob:test-url')

      appendChildSpy.mockRestore()
      removeChildSpy.mockRestore()
    })
  })

  describe('History Popover', () => {
    it('shows history icon for requirements with history_count > 0', async () => {
      renderWithRouter(<RequirementsPage />)

      await waitFor(() => {
        expect(screen.getByText('Problem requirement 1')).toBeInTheDocument()
      })

      // Problem requirement 1 has history_count: 2
      const req1Wrapper = screen.getByText('Problem requirement 1').closest('.requirements-item-wrapper')
      expect(req1Wrapper.querySelector('.history-popover-trigger')).toBeInTheDocument()
    })

    it('does not show history icon for requirements with history_count = 0', async () => {
      renderWithRouter(<RequirementsPage />)

      await waitFor(() => {
        expect(screen.getByText('Problem requirement 2')).toBeInTheDocument()
      })

      // Problem requirement 2 has history_count: 0
      const req2Wrapper = screen.getByText('Problem requirement 2').closest('.requirements-item-wrapper')
      expect(req2Wrapper.querySelector('.history-popover-trigger')).toBeNull()
    })
  })

  describe('Back Link', () => {
    it('shows back to project link', async () => {
      renderWithRouter(<RequirementsPage />)

      await waitFor(() => {
        expect(screen.getByText('Back to Project')).toBeInTheDocument()
      })
    })

    it('back link has correct href', async () => {
      renderWithRouter(<RequirementsPage />)

      await waitFor(() => {
        expect(screen.getByText('Back to Project')).toBeInTheDocument()
      })

      const backLink = screen.getByText('Back to Project')
      expect(backLink).toHaveAttribute('href', `/app/projects/${projectId}`)
    })
  })

  describe('Drag and Drop Reordering', () => {
    it('allows reordering requirements within a section', async () => {
      put.mockResolvedValue({ success: true })

      renderWithRouter(<RequirementsPage />)

      await waitFor(() => {
        expect(screen.getByText('Problem requirement 1')).toBeInTheDocument()
      })

      // Get the item rows in the problems section
      const req1Row = screen.getByText('Problem requirement 1').closest('.item-row')
      const req2Row = screen.getByText('Problem requirement 2').closest('.item-row')

      // Mock dataTransfer
      const dataTransfer = {
        effectAllowed: '',
        setData: vi.fn(),
        getData: vi.fn()
      }

      // Simulate drag from req1 to req2 position
      fireEvent.dragStart(req1Row, { dataTransfer })
      fireEvent.dragOver(req2Row, { dataTransfer })
      fireEvent.drop(req2Row, { dataTransfer })

      await waitFor(() => {
        expect(put).toHaveBeenCalledWith(
          `/api/projects/${projectId}/requirements/reorder`,
          { section: 'problems', requirement_ids: ['req-2', 'req-1'] }
        )
      })
    })
  })
})
