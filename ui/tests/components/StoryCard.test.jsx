import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { StoryCard } from '../../src/components/stories/StoryCard'

describe('StoryCard', () => {
  const mockStory = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    story_id: 'US-001',
    title: 'User login functionality',
    description: 'As a user, I want to log in so that I can access my account',
    acceptance_criteria: [
      'User can enter email and password',
      'Invalid credentials show error message',
      'Successful login redirects to dashboard'
    ],
    size: 'M',
    labels: ['auth', 'frontend', 'priority-high'],
    status: 'draft',
    format: 'classic'
  }

  const mockOnEdit = vi.fn()
  const mockOnDelete = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Collapsed View', () => {
    it('renders story ID badge', () => {
      render(<StoryCard story={mockStory} onEdit={mockOnEdit} onDelete={mockOnDelete} />)

      expect(screen.getByText('US-001')).toBeInTheDocument()
    })

    it('renders story title', () => {
      render(<StoryCard story={mockStory} onEdit={mockOnEdit} onDelete={mockOnDelete} />)

      expect(screen.getByText('User login functionality')).toBeInTheDocument()
    })

    it('renders size indicator', () => {
      render(<StoryCard story={mockStory} onEdit={mockOnEdit} onDelete={mockOnDelete} />)

      expect(screen.getByText('M')).toBeInTheDocument()
    })

    it('renders first 3 labels as chips', () => {
      render(<StoryCard story={mockStory} onEdit={mockOnEdit} onDelete={mockOnDelete} />)

      expect(screen.getByText('auth')).toBeInTheDocument()
      expect(screen.getByText('frontend')).toBeInTheDocument()
      expect(screen.getByText('priority-high')).toBeInTheDocument()
    })

    it('shows +N indicator when more than 3 labels', () => {
      const storyWithManyLabels = {
        ...mockStory,
        labels: ['label1', 'label2', 'label3', 'label4', 'label5']
      }

      render(<StoryCard story={storyWithManyLabels} onEdit={mockOnEdit} onDelete={mockOnDelete} />)

      expect(screen.getByText('+2')).toBeInTheDocument()
    })

    it('does not show labels section when story has no labels', () => {
      const storyWithoutLabels = {
        ...mockStory,
        labels: []
      }

      render(<StoryCard story={storyWithoutLabels} onEdit={mockOnEdit} onDelete={mockOnDelete} />)

      // Labels chips should not be present
      expect(screen.queryByText('auth')).not.toBeInTheDocument()
    })

    it('does not show description in collapsed view', () => {
      render(<StoryCard story={mockStory} onEdit={mockOnEdit} onDelete={mockOnDelete} />)

      expect(screen.queryByText('As a user, I want to log in so that I can access my account')).not.toBeInTheDocument()
    })

    it('does not show acceptance criteria in collapsed view', () => {
      render(<StoryCard story={mockStory} onEdit={mockOnEdit} onDelete={mockOnDelete} />)

      expect(screen.queryByText('User can enter email and password')).not.toBeInTheDocument()
    })
  })

  describe('Expand/Collapse Behavior', () => {
    it('starts collapsed by default', () => {
      render(<StoryCard story={mockStory} onEdit={mockOnEdit} onDelete={mockOnDelete} />)

      expect(screen.queryByText('Description')).not.toBeInTheDocument()
    })

    it('can start expanded when defaultExpanded is true', () => {
      render(<StoryCard story={mockStory} onEdit={mockOnEdit} onDelete={mockOnDelete} defaultExpanded={true} />)

      expect(screen.getByText('Description')).toBeInTheDocument()
    })

    it('expands when header is clicked', () => {
      render(<StoryCard story={mockStory} onEdit={mockOnEdit} onDelete={mockOnDelete} />)

      // Click on the header
      const header = screen.getByText('User login functionality').closest('.story-card-header')
      fireEvent.click(header)

      expect(screen.getByText('Description')).toBeInTheDocument()
    })

    it('collapses when header is clicked again', () => {
      render(<StoryCard story={mockStory} onEdit={mockOnEdit} onDelete={mockOnDelete} defaultExpanded={true} />)

      // Click on the header to collapse
      const header = screen.getByText('User login functionality').closest('.story-card-header')
      fireEvent.click(header)

      expect(screen.queryByText('Description')).not.toBeInTheDocument()
    })

    it('expands when expand button is clicked', () => {
      render(<StoryCard story={mockStory} onEdit={mockOnEdit} onDelete={mockOnDelete} />)

      const expandButton = screen.getByRole('button', { name: 'Expand' })
      fireEvent.click(expandButton)

      expect(screen.getByText('Description')).toBeInTheDocument()
    })

    it('collapses when collapse button is clicked', () => {
      render(<StoryCard story={mockStory} onEdit={mockOnEdit} onDelete={mockOnDelete} defaultExpanded={true} />)

      const collapseButton = screen.getByRole('button', { name: 'Collapse' })
      fireEvent.click(collapseButton)

      expect(screen.queryByText('Description')).not.toBeInTheDocument()
    })

    it('adds expanded class to card when expanded', () => {
      render(<StoryCard story={mockStory} onEdit={mockOnEdit} onDelete={mockOnDelete} />)

      const card = screen.getByText('US-001').closest('.story-card')
      expect(card).not.toHaveClass('story-card--expanded')

      // Expand the card
      const header = screen.getByText('User login functionality').closest('.story-card-header')
      fireEvent.click(header)

      expect(card).toHaveClass('story-card--expanded')
    })
  })

  describe('Expanded View', () => {
    it('shows status badge', () => {
      render(<StoryCard story={mockStory} onEdit={mockOnEdit} onDelete={mockOnDelete} defaultExpanded={true} />)

      expect(screen.getByText('draft')).toBeInTheDocument()
    })

    it('shows format badge', () => {
      render(<StoryCard story={mockStory} onEdit={mockOnEdit} onDelete={mockOnDelete} defaultExpanded={true} />)

      expect(screen.getByText('Classic')).toBeInTheDocument()
    })

    it('shows Job Story format badge when format is job_story', () => {
      const jobStory = { ...mockStory, format: 'job_story' }

      render(<StoryCard story={jobStory} onEdit={mockOnEdit} onDelete={mockOnDelete} defaultExpanded={true} />)

      expect(screen.getByText('Job Story')).toBeInTheDocument()
    })

    it('shows description section', () => {
      render(<StoryCard story={mockStory} onEdit={mockOnEdit} onDelete={mockOnDelete} defaultExpanded={true} />)

      expect(screen.getByText('Description')).toBeInTheDocument()
      expect(screen.getByText('As a user, I want to log in so that I can access my account')).toBeInTheDocument()
    })

    it('shows acceptance criteria section with count', () => {
      render(<StoryCard story={mockStory} onEdit={mockOnEdit} onDelete={mockOnDelete} defaultExpanded={true} />)

      expect(screen.getByText('Acceptance Criteria (3)')).toBeInTheDocument()
    })

    it('lists all acceptance criteria', () => {
      render(<StoryCard story={mockStory} onEdit={mockOnEdit} onDelete={mockOnDelete} defaultExpanded={true} />)

      expect(screen.getByText('User can enter email and password')).toBeInTheDocument()
      expect(screen.getByText('Invalid credentials show error message')).toBeInTheDocument()
      expect(screen.getByText('Successful login redirects to dashboard')).toBeInTheDocument()
    })

    it('shows all labels in expanded view', () => {
      render(<StoryCard story={mockStory} onEdit={mockOnEdit} onDelete={mockOnDelete} defaultExpanded={true} />)

      // Should show Labels section
      expect(screen.getByText('Labels')).toBeInTheDocument()

      // Should show all labels expanded (look in the Labels section)
      const labelsSection = screen.getByText('Labels').closest('.story-card-section')
      expect(labelsSection).toHaveTextContent('auth')
      expect(labelsSection).toHaveTextContent('frontend')
      expect(labelsSection).toHaveTextContent('priority-high')
    })

    it('does not show acceptance criteria section when empty', () => {
      const storyWithoutCriteria = {
        ...mockStory,
        acceptance_criteria: []
      }

      render(<StoryCard story={storyWithoutCriteria} onEdit={mockOnEdit} onDelete={mockOnDelete} defaultExpanded={true} />)

      expect(screen.queryByText(/Acceptance Criteria/)).not.toBeInTheDocument()
    })
  })

  describe('Size Indicator', () => {
    it('applies correct class for XS size', () => {
      const story = { ...mockStory, size: 'XS' }
      render(<StoryCard story={story} onEdit={mockOnEdit} onDelete={mockOnDelete} />)

      const sizeElement = screen.getByText('XS')
      expect(sizeElement).toHaveClass('story-card-size--xs')
    })

    it('applies correct class for S size', () => {
      const story = { ...mockStory, size: 'S' }
      render(<StoryCard story={story} onEdit={mockOnEdit} onDelete={mockOnDelete} />)

      const sizeElement = screen.getByText('S')
      expect(sizeElement).toHaveClass('story-card-size--s')
    })

    it('applies correct class for L size', () => {
      const story = { ...mockStory, size: 'L' }
      render(<StoryCard story={story} onEdit={mockOnEdit} onDelete={mockOnDelete} />)

      const sizeElement = screen.getByText('L')
      expect(sizeElement).toHaveClass('story-card-size--l')
    })

    it('applies correct class for XL size', () => {
      const story = { ...mockStory, size: 'XL' }
      render(<StoryCard story={story} onEdit={mockOnEdit} onDelete={mockOnDelete} />)

      const sizeElement = screen.getByText('XL')
      expect(sizeElement).toHaveClass('story-card-size--xl')
    })

    it('defaults to M when size is not provided', () => {
      const story = { ...mockStory, size: null }
      render(<StoryCard story={story} onEdit={mockOnEdit} onDelete={mockOnDelete} />)

      expect(screen.getByText('M')).toBeInTheDocument()
    })
  })

  describe('Status Classes', () => {
    it('applies draft class for draft status', () => {
      render(<StoryCard story={mockStory} onEdit={mockOnEdit} onDelete={mockOnDelete} defaultExpanded={true} />)

      const statusElement = screen.getByText('draft')
      expect(statusElement).toHaveClass('story-card-status--draft')
    })

    it('applies ready class for ready status', () => {
      const story = { ...mockStory, status: 'ready' }
      render(<StoryCard story={story} onEdit={mockOnEdit} onDelete={mockOnDelete} defaultExpanded={true} />)

      const statusElement = screen.getByText('ready')
      expect(statusElement).toHaveClass('story-card-status--ready')
    })

    it('applies exported class for exported status', () => {
      const story = { ...mockStory, status: 'exported' }
      render(<StoryCard story={story} onEdit={mockOnEdit} onDelete={mockOnDelete} defaultExpanded={true} />)

      const statusElement = screen.getByText('exported')
      expect(statusElement).toHaveClass('story-card-status--exported')
    })
  })

  describe('Edit Action', () => {
    it('shows edit button when expanded', () => {
      render(<StoryCard story={mockStory} onEdit={mockOnEdit} onDelete={mockOnDelete} defaultExpanded={true} />)

      expect(screen.getByRole('button', { name: /Edit/i })).toBeInTheDocument()
    })

    it('does not show edit button when collapsed', () => {
      render(<StoryCard story={mockStory} onEdit={mockOnEdit} onDelete={mockOnDelete} />)

      expect(screen.queryByRole('button', { name: /Edit/i })).not.toBeInTheDocument()
    })

    it('calls onEdit with story when edit button is clicked', () => {
      render(<StoryCard story={mockStory} onEdit={mockOnEdit} onDelete={mockOnDelete} defaultExpanded={true} />)

      fireEvent.click(screen.getByRole('button', { name: /Edit/i }))

      expect(mockOnEdit).toHaveBeenCalledTimes(1)
      expect(mockOnEdit).toHaveBeenCalledWith(mockStory)
    })

    it('edit button click does not toggle expand state', () => {
      render(<StoryCard story={mockStory} onEdit={mockOnEdit} onDelete={mockOnDelete} defaultExpanded={true} />)

      fireEvent.click(screen.getByRole('button', { name: /Edit/i }))

      // Should still be expanded
      expect(screen.getByText('Description')).toBeInTheDocument()
    })
  })

  describe('Delete Action', () => {
    it('shows delete button when expanded', () => {
      render(<StoryCard story={mockStory} onEdit={mockOnEdit} onDelete={mockOnDelete} defaultExpanded={true} />)

      expect(screen.getByRole('button', { name: /Delete/i })).toBeInTheDocument()
    })

    it('does not show delete button when collapsed', () => {
      render(<StoryCard story={mockStory} onEdit={mockOnEdit} onDelete={mockOnDelete} />)

      expect(screen.queryByRole('button', { name: /Delete/i })).not.toBeInTheDocument()
    })

    it('shows confirmation modal when delete button is clicked', () => {
      render(<StoryCard story={mockStory} onEdit={mockOnEdit} onDelete={mockOnDelete} defaultExpanded={true} />)

      fireEvent.click(screen.getByRole('button', { name: /Delete/i }))

      // Use heading role for the modal title to avoid matching the button text
      expect(screen.getByRole('heading', { name: 'Delete Story' })).toBeInTheDocument()
      expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument()
      // US-001 appears in both the card and modal, use getAllByText
      expect(screen.getAllByText('US-001').length).toBeGreaterThanOrEqual(1)
    })

    it('shows story title in delete confirmation', () => {
      render(<StoryCard story={mockStory} onEdit={mockOnEdit} onDelete={mockOnDelete} defaultExpanded={true} />)

      fireEvent.click(screen.getByRole('button', { name: /Delete/i }))

      // Story title appears in both card header and warning message - verify both exist
      expect(screen.getAllByText(/User login functionality/).length).toBeGreaterThanOrEqual(2)
    })

    it('shows warning message in confirmation modal', () => {
      render(<StoryCard story={mockStory} onEdit={mockOnEdit} onDelete={mockOnDelete} defaultExpanded={true} />)

      fireEvent.click(screen.getByRole('button', { name: /Delete/i }))

      expect(screen.getByText(/This action cannot be undone/)).toBeInTheDocument()
    })

    it('closes confirmation modal when Cancel is clicked', () => {
      render(<StoryCard story={mockStory} onEdit={mockOnEdit} onDelete={mockOnDelete} defaultExpanded={true} />)

      fireEvent.click(screen.getByRole('button', { name: /Delete/i }))

      // Click Cancel in the modal
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

      // Modal should be closed
      expect(screen.queryByText(/Are you sure you want to delete/)).not.toBeInTheDocument()
    })

    it('calls onDelete with story ID when confirmed', async () => {
      mockOnDelete.mockResolvedValue()

      render(<StoryCard story={mockStory} onEdit={mockOnEdit} onDelete={mockOnDelete} defaultExpanded={true} />)

      fireEvent.click(screen.getByRole('button', { name: /Delete/i }))

      // Click Delete Story in the modal
      fireEvent.click(screen.getByRole('button', { name: 'Delete Story' }))

      await waitFor(() => {
        expect(mockOnDelete).toHaveBeenCalledWith(mockStory.id)
      })
    })

    it('shows loading state while deleting', async () => {
      mockOnDelete.mockImplementation(() => new Promise(() => {})) // Never resolves

      render(<StoryCard story={mockStory} onEdit={mockOnEdit} onDelete={mockOnDelete} defaultExpanded={true} />)

      fireEvent.click(screen.getByRole('button', { name: /Delete/i }))
      fireEvent.click(screen.getByRole('button', { name: 'Delete Story' }))

      await waitFor(() => {
        expect(screen.getByText('Deleting...')).toBeInTheDocument()
      })
    })

    it('disables buttons while deleting', async () => {
      mockOnDelete.mockImplementation(() => new Promise(() => {})) // Never resolves

      render(<StoryCard story={mockStory} onEdit={mockOnEdit} onDelete={mockOnDelete} defaultExpanded={true} />)

      fireEvent.click(screen.getByRole('button', { name: /Delete/i }))
      fireEvent.click(screen.getByRole('button', { name: 'Delete Story' }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Deleting...' })).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
      })
    })

    it('closes modal after successful delete', async () => {
      mockOnDelete.mockResolvedValue()

      render(<StoryCard story={mockStory} onEdit={mockOnEdit} onDelete={mockOnDelete} defaultExpanded={true} />)

      fireEvent.click(screen.getByRole('button', { name: /Delete/i }))
      fireEvent.click(screen.getByRole('button', { name: 'Delete Story' }))

      await waitFor(() => {
        expect(screen.queryByText(/Are you sure you want to delete/)).not.toBeInTheDocument()
      })
    })

    it('keeps modal open on delete error', async () => {
      mockOnDelete.mockRejectedValue(new Error('Delete failed'))

      render(<StoryCard story={mockStory} onEdit={mockOnEdit} onDelete={mockOnDelete} defaultExpanded={true} />)

      fireEvent.click(screen.getByRole('button', { name: /Delete/i }))
      fireEvent.click(screen.getByRole('button', { name: 'Delete Story' }))

      await waitFor(() => {
        // Modal should still be visible after error
        expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument()
      })
    })

    it('delete button click does not toggle expand state', () => {
      render(<StoryCard story={mockStory} onEdit={mockOnEdit} onDelete={mockOnDelete} defaultExpanded={true} />)

      fireEvent.click(screen.getByRole('button', { name: /Delete/i }))

      // Should still be expanded
      expect(screen.getByText('Description')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('expand button has proper aria-label when collapsed', () => {
      render(<StoryCard story={mockStory} onEdit={mockOnEdit} onDelete={mockOnDelete} />)

      expect(screen.getByRole('button', { name: 'Expand' })).toBeInTheDocument()
    })

    it('expand button has proper aria-label when expanded', () => {
      render(<StoryCard story={mockStory} onEdit={mockOnEdit} onDelete={mockOnDelete} defaultExpanded={true} />)

      expect(screen.getByRole('button', { name: 'Collapse' })).toBeInTheDocument()
    })

    it('all buttons have proper type attribute', () => {
      render(<StoryCard story={mockStory} onEdit={mockOnEdit} onDelete={mockOnDelete} defaultExpanded={true} />)

      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        expect(button).toHaveAttribute('type', 'button')
      })
    })
  })
})
