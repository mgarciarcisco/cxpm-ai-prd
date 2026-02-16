import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ItemRow } from '../../src/components/common/ItemRow'

// Mock the api module
vi.mock('../../src/services/api', () => ({
  put: vi.fn(),
  del: vi.fn()
}))

import { put, del } from '../../src/services/api'

describe('ItemRow', () => {
  const mockItem = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    content: 'Test item content',
    section: 'needs_and_goals'
  }

  const defaultProps = {
    item: mockItem,
    onEdit: vi.fn(),
    onDelete: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('renders item content', () => {
      render(<ItemRow {...defaultProps} />)
      expect(screen.getByText('Test item content')).toBeInTheDocument()
    })

    it('renders edit button', () => {
      render(<ItemRow {...defaultProps} />)
      expect(screen.getByLabelText('Edit item')).toBeInTheDocument()
    })

    it('renders delete button', () => {
      render(<ItemRow {...defaultProps} />)
      expect(screen.getByLabelText('Delete item')).toBeInTheDocument()
    })
  })

  describe('Inline Editing', () => {
    it('switches to edit mode when edit button is clicked', () => {
      render(<ItemRow {...defaultProps} />)

      fireEvent.click(screen.getByLabelText('Edit item'))

      // Should show textarea with current content
      expect(screen.getByDisplayValue('Test item content')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
    })

    it('allows editing content in textarea', () => {
      render(<ItemRow {...defaultProps} />)

      fireEvent.click(screen.getByLabelText('Edit item'))

      const textarea = screen.getByDisplayValue('Test item content')
      fireEvent.change(textarea, { target: { value: 'Updated content' } })

      expect(screen.getByDisplayValue('Updated content')).toBeInTheDocument()
    })

    it('cancels edit and restores original content', () => {
      render(<ItemRow {...defaultProps} />)

      // Enter edit mode
      fireEvent.click(screen.getByLabelText('Edit item'))

      // Change content
      const textarea = screen.getByDisplayValue('Test item content')
      fireEvent.change(textarea, { target: { value: 'Modified content' } })

      // Cancel
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

      // Should show original content, not modified
      expect(screen.getByText('Test item content')).toBeInTheDocument()
      expect(screen.queryByDisplayValue('Modified content')).not.toBeInTheDocument()
    })

    it('saves changes via API when save button is clicked', async () => {
      const updatedItem = { ...mockItem, content: 'Updated content' }
      put.mockResolvedValue(updatedItem)

      render(<ItemRow {...defaultProps} />)

      // Enter edit mode
      fireEvent.click(screen.getByLabelText('Edit item'))

      // Change content
      const textarea = screen.getByDisplayValue('Test item content')
      fireEvent.change(textarea, { target: { value: 'Updated content' } })

      // Save
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      await waitFor(() => {
        expect(put).toHaveBeenCalledWith(`/api/meeting-items/${mockItem.id}`, {
          content: 'Updated content'
        })
        expect(defaultProps.onEdit).toHaveBeenCalledWith(updatedItem)
      })
    })

    it('displays error message when save fails', async () => {
      put.mockRejectedValue(new Error('Failed to save'))

      render(<ItemRow {...defaultProps} />)

      fireEvent.click(screen.getByLabelText('Edit item'))

      const textarea = screen.getByDisplayValue('Test item content')
      fireEvent.change(textarea, { target: { value: 'Updated content' } })

      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      await waitFor(() => {
        expect(screen.getByText('Failed to save')).toBeInTheDocument()
      })
    })

    it('disables save button when content is empty', () => {
      render(<ItemRow {...defaultProps} />)

      fireEvent.click(screen.getByLabelText('Edit item'))

      const textarea = screen.getByDisplayValue('Test item content')
      fireEvent.change(textarea, { target: { value: '' } })

      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    })

    it('disables save button when content is only whitespace', () => {
      render(<ItemRow {...defaultProps} />)

      fireEvent.click(screen.getByLabelText('Edit item'))

      const textarea = screen.getByDisplayValue('Test item content')
      fireEvent.change(textarea, { target: { value: '   ' } })

      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    })

    it('cancels edit on Escape key', () => {
      render(<ItemRow {...defaultProps} />)

      fireEvent.click(screen.getByLabelText('Edit item'))

      const textarea = screen.getByDisplayValue('Test item content')
      fireEvent.change(textarea, { target: { value: 'Modified' } })
      fireEvent.keyDown(textarea, { key: 'Escape' })

      // Should exit edit mode
      expect(screen.getByText('Test item content')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    })

    it('saves on Ctrl+Enter', async () => {
      const updatedItem = { ...mockItem, content: 'Saved via keyboard' }
      put.mockResolvedValue(updatedItem)

      render(<ItemRow {...defaultProps} />)

      fireEvent.click(screen.getByLabelText('Edit item'))

      const textarea = screen.getByDisplayValue('Test item content')
      fireEvent.change(textarea, { target: { value: 'Saved via keyboard' } })
      fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true })

      await waitFor(() => {
        expect(put).toHaveBeenCalledWith(`/api/meeting-items/${mockItem.id}`, {
          content: 'Saved via keyboard'
        })
      })
    })

    it('shows "Saving..." text while save is in progress', async () => {
      put.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(mockItem), 100)))

      render(<ItemRow {...defaultProps} />)

      fireEvent.click(screen.getByLabelText('Edit item'))

      const textarea = screen.getByDisplayValue('Test item content')
      fireEvent.change(textarea, { target: { value: 'Updated' } })

      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      expect(screen.getByText('Saving...')).toBeInTheDocument()
    })
  })

  describe('Delete Confirmation', () => {
    it('shows confirmation dialog when delete button is clicked', () => {
      render(<ItemRow {...defaultProps} />)

      fireEvent.click(screen.getByLabelText('Delete item'))

      expect(screen.getByText('Delete this item?')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    })

    it('cancels delete when cancel button is clicked', () => {
      render(<ItemRow {...defaultProps} />)

      fireEvent.click(screen.getByLabelText('Delete item'))
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

      // Should return to normal view
      expect(screen.getByText('Test item content')).toBeInTheDocument()
      expect(screen.queryByText('Delete this item?')).not.toBeInTheDocument()
    })

    it('deletes item via API when confirm button is clicked', async () => {
      del.mockResolvedValue()

      render(<ItemRow {...defaultProps} />)

      fireEvent.click(screen.getByLabelText('Delete item'))
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

      await waitFor(() => {
        expect(del).toHaveBeenCalledWith(`/api/meeting-items/${mockItem.id}`)
        expect(defaultProps.onDelete).toHaveBeenCalledWith(mockItem)
      })
    })

    it('displays error message when delete fails', async () => {
      del.mockRejectedValue(new Error('Delete failed'))

      render(<ItemRow {...defaultProps} />)

      fireEvent.click(screen.getByLabelText('Delete item'))
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

      await waitFor(() => {
        expect(screen.getByText('Delete failed')).toBeInTheDocument()
      })
    })

    it('shows "Deleting..." text while delete is in progress', async () => {
      del.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))

      render(<ItemRow {...defaultProps} />)

      fireEvent.click(screen.getByLabelText('Delete item'))
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

      expect(screen.getByText('Deleting...')).toBeInTheDocument()
    })

    it('disables buttons while delete is in progress', async () => {
      del.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))

      render(<ItemRow {...defaultProps} />)

      fireEvent.click(screen.getByLabelText('Delete item'))
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
      expect(screen.getByText('Deleting...').closest('button')).toBeDisabled()
    })
  })

  describe('Source Quote Display', () => {
    it('renders source quote when present', () => {
      const itemWithSource = {
        ...mockItem,
        source_quote: 'This is the original quote from the meeting'
      }
      render(<ItemRow {...defaultProps} item={itemWithSource} />)

      expect(screen.getByText(/This is the original quote from the meeting/)).toBeInTheDocument()
    })

    it('does not render source quote when not present', () => {
      render(<ItemRow {...defaultProps} />)

      // Should not have any source quote element
      expect(screen.queryByText(/original quote/)).not.toBeInTheDocument()
    })
  })

  describe('Speaker Display', () => {
    it('renders speaker name before source quote when speaker prop is provided', () => {
      const itemWithSpeaker = {
        ...mockItem,
        speaker: 'John Doe',
        source_quote: 'This is the original quote'
      }
      render(<ItemRow {...defaultProps} item={itemWithSpeaker} />)

      expect(screen.getByText('John Doe:')).toBeInTheDocument()
      expect(screen.getByText(/This is the original quote/)).toBeInTheDocument()

      // Verify speaker appears before the quote in the DOM
      const sourceText = screen.getByText('John Doe:').closest('.item-row-source-text')
      expect(sourceText).toHaveTextContent('John Doe: "This is the original quote"')
    })

    it('renders speaker name without quote when only speaker is provided', () => {
      const itemWithSpeakerOnly = {
        ...mockItem,
        speaker: 'Jane Smith',
        source_quote: null
      }
      render(<ItemRow {...defaultProps} item={itemWithSpeakerOnly} />)

      expect(screen.getByText('Jane Smith:')).toBeInTheDocument()
    })

    it('does not render speaker element when speaker prop is not provided', () => {
      render(<ItemRow {...defaultProps} />)

      expect(screen.queryByText(/:$/)).not.toBeInTheDocument()
      expect(document.querySelector('.item-row-speaker')).toBeNull()
    })
  })

  describe('Priority Badge', () => {
    it('renders priority badge with correct class when priority prop is provided', () => {
      const itemWithPriority = {
        ...mockItem,
        priority: 'P1'
      }
      render(<ItemRow {...defaultProps} item={itemWithPriority} />)

      const badge = screen.getByText('P1')
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveClass('item-row-priority')
      expect(badge).toHaveClass('item-row-priority--P1')
    })

    it('renders different priority levels with correct classes', () => {
      const itemWithP2 = {
        ...mockItem,
        priority: 'P2'
      }
      render(<ItemRow {...defaultProps} item={itemWithP2} />)

      const badge = screen.getByText('P2')
      expect(badge).toHaveClass('item-row-priority--P2')
    })

    it('does not render priority badge when priority prop is not provided', () => {
      render(<ItemRow {...defaultProps} />)

      expect(document.querySelector('.item-row-priority')).toBeNull()
    })
  })

  describe('Edge Cases', () => {
    it('handles item without onEdit callback', () => {
      render(<ItemRow item={mockItem} onDelete={vi.fn()} />)

      // Should render without errors
      expect(screen.getByText('Test item content')).toBeInTheDocument()
    })

    it('handles item without onDelete callback', () => {
      render(<ItemRow item={mockItem} onEdit={vi.fn()} />)

      // Should render without errors
      expect(screen.getByText('Test item content')).toBeInTheDocument()
    })

    it('trims whitespace from content before saving', async () => {
      const updatedItem = { ...mockItem, content: 'Trimmed content' }
      put.mockResolvedValue(updatedItem)

      render(<ItemRow {...defaultProps} />)

      fireEvent.click(screen.getByLabelText('Edit item'))

      const textarea = screen.getByDisplayValue('Test item content')
      fireEvent.change(textarea, { target: { value: '  Trimmed content  ' } })

      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      await waitFor(() => {
        expect(put).toHaveBeenCalledWith(`/api/meeting-items/${mockItem.id}`, {
          content: 'Trimmed content'
        })
      })
    })
  })
})
