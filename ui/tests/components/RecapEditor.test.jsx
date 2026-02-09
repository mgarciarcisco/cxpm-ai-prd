import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { RecapEditor } from '../../src/components/meetings/RecapEditor'

// Mock the api module
vi.mock('../../src/services/api', () => ({
  put: vi.fn(),
  post: vi.fn(),
  del: vi.fn()
}))

import { put, post } from '../../src/services/api'

describe('RecapEditor', () => {
  const mockMeetingId = '123e4567-e89b-12d3-a456-426614174000'

  const mockItems = [
    { id: '1', section: 'needs_and_goals', content: 'Problem 1', source_quote: 'Quote for problem 1' },
    { id: '2', section: 'needs_and_goals', content: 'Problem 2', source_quote: null },
    { id: '3', section: 'requirements', content: 'Goal 1', source_quote: 'User said they want this' },
    { id: '4', section: 'scope_and_constraints', content: 'Requirement 1', source_quote: null },
  ]

  const defaultProps = {
    meetingId: mockMeetingId,
    items: mockItems,
    onEditItem: vi.fn(),
    onDeleteItem: vi.fn(),
    onAddItem: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Section Display', () => {
    it('renders the active section (defaults to needs_and_goals)', () => {
      render(<RecapEditor {...defaultProps} />)

      expect(screen.getByText('Needs & Goals')).toBeInTheDocument()
    })

    it('renders different sections when activeSection prop changes', () => {
      const { rerender } = render(<RecapEditor {...defaultProps} activeSection="requirements" />)
      expect(screen.getByText('Requirements')).toBeInTheDocument()

      rerender(<RecapEditor {...defaultProps} activeSection="scope_and_constraints" />)
      expect(screen.getByText('Scope & Constraints')).toBeInTheDocument()

      rerender(<RecapEditor {...defaultProps} activeSection="risks_and_questions" />)
      expect(screen.getByText('Risks & Open Questions')).toBeInTheDocument()

      rerender(<RecapEditor {...defaultProps} activeSection="action_items" />)
      expect(screen.getByText('Action Items')).toBeInTheDocument()
    })

    it('displays items within the active section', () => {
      render(<RecapEditor {...defaultProps} activeSection="needs_and_goals" />)

      // needs_and_goals items should be rendered
      expect(screen.getByText('Problem 1')).toBeInTheDocument()
      expect(screen.getByText('Problem 2')).toBeInTheDocument()
    })

    it('shows empty message for sections with no items', () => {
      render(<RecapEditor {...defaultProps} activeSection="risks_and_questions" />)

      // risks_and_questions has no items, should show empty message
      const emptyMessage = screen.getByText('No items extracted for this section')
      expect(emptyMessage).toBeInTheDocument()
    })

    it('displays item count in section headers', () => {
      render(<RecapEditor {...defaultProps} activeSection="needs_and_goals" />)

      // Needs & Goals has 2 items
      const needsSection = screen.getByText('Needs & Goals').closest('.collapsible-section')
      expect(needsSection).toHaveTextContent('2')
    })
  })

  describe('Source Quote Display', () => {
    it('displays source_quote when present in ItemRow', () => {
      render(<RecapEditor {...defaultProps} />)

      // ItemRow renders source_quote with quotes inside .item-row-source-text
      const sourceTexts = document.querySelectorAll('.item-row-source-text')
      const sourceContents = Array.from(sourceTexts).map(el => el.textContent)
      expect(sourceContents.some(text => text.includes('Quote for problem 1'))).toBe(true)
    })

    it('renders source section only for items with source_quote', () => {
      render(<RecapEditor {...defaultProps} />)

      // Only 1 of the 2 needs_and_goals items has a source_quote
      const sourceSections = document.querySelectorAll('.item-row-source')
      expect(sourceSections.length).toBe(1) // Only Problem 1 has source_quote in the active section
    })

    it('does not display source section when source_quote is null', () => {
      // Render with only items that have no source_quote
      const itemsWithoutQuotes = [
        { id: '1', section: 'needs_and_goals', content: 'Problem without quote', source_quote: null }
      ]
      render(<RecapEditor {...defaultProps} items={itemsWithoutQuotes} />)

      expect(screen.getByText('Problem without quote')).toBeInTheDocument()
      expect(document.querySelector('.item-row-source')).not.toBeInTheDocument()
    })
  })

  describe('Add Item Functionality', () => {
    it('shows add item button for the active section', () => {
      render(<RecapEditor {...defaultProps} />)

      const addButtons = screen.getAllByText('Add item')
      expect(addButtons.length).toBe(1) // One for the active section
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
      const newItem = { id: '5', section: 'needs_and_goals', content: 'New item content' }
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
          { section: 'needs_and_goals', content: 'New item content' }
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
