import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { RecapEditor } from '../../src/components/meetings/RecapEditor'

// Mock the api module
vi.mock('../../src/services/api', () => ({
  put: vi.fn(),
  post: vi.fn()
}))

import { put, post } from '../../src/services/api'

describe('RecapEditor', () => {
  const mockMeetingId = '123e4567-e89b-12d3-a456-426614174000'

  const mockItems = [
    { id: '1', section: 'problems', content: 'Problem 1', source_quote: 'Quote for problem 1' },
    { id: '2', section: 'problems', content: 'Problem 2', source_quote: null },
    { id: '3', section: 'user_goals', content: 'Goal 1', source_quote: 'User said they want this' },
    { id: '4', section: 'functional_requirements', content: 'Requirement 1', source_quote: null },
  ]

  const defaultProps = {
    meetingId: mockMeetingId,
    items: mockItems,
    onEditItem: vi.fn(),
    onDeleteItem: vi.fn(),
    onReorderItems: vi.fn(),
    onAddItem: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Section Display', () => {
    it('renders all 9 sections', () => {
      render(<RecapEditor {...defaultProps} />)

      expect(screen.getByText('Problems')).toBeInTheDocument()
      expect(screen.getByText('User Goals')).toBeInTheDocument()
      expect(screen.getByText('Functional Requirements')).toBeInTheDocument()
      expect(screen.getByText('Data Needs')).toBeInTheDocument()
      expect(screen.getByText('Constraints')).toBeInTheDocument()
      expect(screen.getByText('Non-Goals')).toBeInTheDocument()
      expect(screen.getByText('Risks & Assumptions')).toBeInTheDocument()
      expect(screen.getByText('Open Questions')).toBeInTheDocument()
      expect(screen.getByText('Action Items')).toBeInTheDocument()
    })

    it('displays items within correct sections', () => {
      render(<RecapEditor {...defaultProps} />)

      // Items should be rendered
      expect(screen.getByText('Problem 1')).toBeInTheDocument()
      expect(screen.getByText('Problem 2')).toBeInTheDocument()
      expect(screen.getByText('Goal 1')).toBeInTheDocument()
      expect(screen.getByText('Requirement 1')).toBeInTheDocument()
    })

    it('shows empty message for sections with no items', () => {
      render(<RecapEditor {...defaultProps} />)

      // Sections without items should show empty message
      // data_needs, constraints, non_goals, risks_assumptions, open_questions, action_items are empty (6 sections)
      const emptyMessages = screen.getAllByText('No items extracted for this section')
      expect(emptyMessages.length).toBe(6) // 6 empty sections
    })

    it('displays item count in section headers', () => {
      render(<RecapEditor {...defaultProps} />)

      // Problems has 2 items, User Goals has 1, Functional Requirements has 1
      // The counts are displayed as badges (exact format depends on CollapsibleSection implementation)
      const problemsSection = screen.getByText('Problems').closest('.collapsible-section')
      expect(problemsSection).toHaveTextContent('2')

      const goalsSection = screen.getByText('User Goals').closest('.collapsible-section')
      expect(goalsSection).toHaveTextContent('1')
    })
  })

  describe('Source Quote Display', () => {
    it('displays source_quote when present', () => {
      render(<RecapEditor {...defaultProps} />)

      // source_quote should be displayed
      expect(screen.getByText('"Quote for problem 1"')).toBeInTheDocument()
      expect(screen.getByText('"User said they want this"')).toBeInTheDocument()
    })

    it('shows "Source:" label before quote', () => {
      render(<RecapEditor {...defaultProps} />)

      const sourceLabels = screen.getAllByText('Source:')
      expect(sourceLabels.length).toBe(2) // Only 2 items have source_quote
    })

    it('does not display source section when source_quote is null', () => {
      // Render with only items that have no source_quote
      const itemsWithoutQuotes = [
        { id: '1', section: 'problems', content: 'Problem without quote', source_quote: null }
      ]
      render(<RecapEditor {...defaultProps} items={itemsWithoutQuotes} />)

      expect(screen.getByText('Problem without quote')).toBeInTheDocument()
      expect(screen.queryByText('Source:')).not.toBeInTheDocument()
    })
  })

  describe('Add Item Functionality', () => {
    it('shows add item button for each section', () => {
      render(<RecapEditor {...defaultProps} />)

      const addButtons = screen.getAllByText('Add item')
      expect(addButtons.length).toBe(9) // One for each section
    })

    it('opens add form when clicking add item button', () => {
      render(<RecapEditor {...defaultProps} />)

      const addButtons = screen.getAllByText('Add item')
      fireEvent.click(addButtons[0]) // Click first "Add item" button

      expect(screen.getByPlaceholderText('Enter new item content...')).toBeInTheDocument()
      expect(screen.getByText('Cancel')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Add Item' })).toBeInTheDocument()
    })

    it('submits new item via API and calls onAddItem', async () => {
      const newItem = { id: '5', section: 'problems', content: 'New item content' }
      post.mockResolvedValue(newItem)

      render(<RecapEditor {...defaultProps} />)

      // Click add button in Problems section
      const addButtons = screen.getAllByText('Add item')
      fireEvent.click(addButtons[0])

      // Type content
      const textarea = screen.getByPlaceholderText('Enter new item content...')
      fireEvent.change(textarea, { target: { value: 'New item content' } })

      // Submit
      const submitButton = screen.getByRole('button', { name: 'Add Item' })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(post).toHaveBeenCalledWith(
          `/api/meetings/${mockMeetingId}/items`,
          { section: 'problems', content: 'New item content' }
        )
        expect(defaultProps.onAddItem).toHaveBeenCalledWith(newItem)
      })
    })

    it('cancels add form when clicking cancel', () => {
      render(<RecapEditor {...defaultProps} />)

      const addButtons = screen.getAllByText('Add item')
      fireEvent.click(addButtons[0])

      // Verify form is open
      expect(screen.getByPlaceholderText('Enter new item content...')).toBeInTheDocument()

      // Click cancel
      fireEvent.click(screen.getByText('Cancel'))

      // Form should be closed
      expect(screen.queryByPlaceholderText('Enter new item content...')).not.toBeInTheDocument()
    })

    it('disables submit button when content is empty', () => {
      render(<RecapEditor {...defaultProps} />)

      const addButtons = screen.getAllByText('Add item')
      fireEvent.click(addButtons[0])

      const submitButton = screen.getByRole('button', { name: 'Add Item' })
      expect(submitButton).toBeDisabled()
    })

    it('displays error message when API call fails', async () => {
      post.mockRejectedValue(new Error('Network error'))

      render(<RecapEditor {...defaultProps} />)

      const addButtons = screen.getAllByText('Add item')
      fireEvent.click(addButtons[0])

      const textarea = screen.getByPlaceholderText('Enter new item content...')
      fireEvent.change(textarea, { target: { value: 'New item content' } })

      const submitButton = screen.getByRole('button', { name: 'Add Item' })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })
    })
  })

  describe('Drag and Drop', () => {
    it('calls onReorderItems after successful reorder', async () => {
      const reorderedItems = [mockItems[1], mockItems[0]] // Reversed
      put.mockResolvedValue(reorderedItems)

      render(<RecapEditor {...defaultProps} />)

      // Get the item rows - they should be draggable
      const itemRows = screen.getAllByText('Problem 1').map(el => el.closest('.item-row'))
      const draggedRow = itemRows[0]
      const targetRow = screen.getByText('Problem 2').closest('.item-row')

      // Mock dataTransfer for jsdom
      const dataTransfer = {
        effectAllowed: '',
        setData: vi.fn(),
        getData: vi.fn()
      }

      // Simulate drag start
      fireEvent.dragStart(draggedRow, { dataTransfer })

      // Simulate drag over target
      fireEvent.dragOver(targetRow, { dataTransfer })

      // Simulate drop
      fireEvent.drop(targetRow, { dataTransfer })

      await waitFor(() => {
        expect(put).toHaveBeenCalledWith(
          `/api/meetings/${mockMeetingId}/items/reorder`,
          { section: 'problems', item_ids: ['2', '1'] }
        )
      })
    })
  })

  describe('Edit and Delete Callbacks', () => {
    it('passes onEdit callback to ItemRow', async () => {
      const updatedItem = { ...mockItems[0], content: 'Updated content' }

      // Mock the put call that ItemRow makes
      put.mockResolvedValue(updatedItem)

      render(<RecapEditor {...defaultProps} />)

      // Find and click the edit button for the first item
      const editButtons = screen.getAllByLabelText('Edit item')
      fireEvent.click(editButtons[0])

      // Edit the content
      const textarea = screen.getByDisplayValue('Problem 1')
      fireEvent.change(textarea, { target: { value: 'Updated content' } })

      // Save
      const saveButton = screen.getByRole('button', { name: 'Save' })
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(defaultProps.onEditItem).toHaveBeenCalledWith(updatedItem)
      })
    })
  })
})
