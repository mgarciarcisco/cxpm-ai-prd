import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ProjectCard from '../../src/components/projects/ProjectCard'

// Mock navigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate
  }
})

const renderWithRouter = (component) => {
  return render(
    <MemoryRouter>
      {component}
    </MemoryRouter>
  )
}

describe('ProjectCard', () => {
  const mockProject = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Project',
    description: 'A test project description that is quite long and should be displayed',
    progress: 45,
    requirements_status: 'reviewed',
    prd_status: 'draft',
    stories_status: 'empty',
    mockups_status: 'empty',
    export_status: 'not_exported',
    updated_at: '2026-01-20T10:00:00Z'
  }

  const defaultProps = {
    project: mockProject,
    meetingCount: 5,
    lastActivity: '2026-01-20T10:00:00Z',
    onEdit: vi.fn(),
    onDelete: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockClear()
  })

  describe('Project Name and Description', () => {
    it('renders project name', () => {
      renderWithRouter(<ProjectCard {...defaultProps} />)
      expect(screen.getByText('Test Project')).toBeInTheDocument()
    })

    it('renders project description', () => {
      renderWithRouter(<ProjectCard {...defaultProps} />)
      expect(screen.getByText('A test project description that is quite long and should be displayed')).toBeInTheDocument()
    })

    it('renders "No description" when description is null', () => {
      const projectWithoutDescription = {
        ...mockProject,
        description: null
      }
      renderWithRouter(
        <ProjectCard {...defaultProps} project={projectWithoutDescription} />
      )
      expect(screen.getByText('No description')).toBeInTheDocument()
    })

    it('renders "No description" when description is empty string', () => {
      const projectWithEmptyDescription = {
        ...mockProject,
        description: ''
      }
      renderWithRouter(
        <ProjectCard {...defaultProps} project={projectWithEmptyDescription} />
      )
      expect(screen.getByText('No description')).toBeInTheDocument()
    })
  })

  describe('Mini Stepper', () => {
    it('renders mini stepper with 5 stage dots', () => {
      renderWithRouter(<ProjectCard {...defaultProps} />)
      const stepper = screen.getByLabelText('Stage progress')
      expect(stepper).toBeInTheDocument()
      // Should have 5 dots for Requirements, PRD, Stories, Mockups, Export
      const dots = stepper.querySelectorAll('.project-card__mini-stepper-dot')
      expect(dots).toHaveLength(5)
    })

    it('shows complete status for reviewed requirements', () => {
      renderWithRouter(<ProjectCard {...defaultProps} />)
      const reqDot = screen.getByLabelText('Requirements: complete')
      expect(reqDot).toBeInTheDocument()
      expect(reqDot).toHaveClass('project-card__mini-stepper-dot--complete')
    })

    it('shows in_progress status for draft PRD', () => {
      renderWithRouter(<ProjectCard {...defaultProps} />)
      const prdDot = screen.getByLabelText('PRD: in progress')
      expect(prdDot).toBeInTheDocument()
      expect(prdDot).toHaveClass('project-card__mini-stepper-dot--in_progress')
    })

    it('shows empty status for empty stories', () => {
      renderWithRouter(<ProjectCard {...defaultProps} />)
      const storiesDot = screen.getByLabelText('User Stories: empty')
      expect(storiesDot).toBeInTheDocument()
      expect(storiesDot).toHaveClass('project-card__mini-stepper-dot--empty')
    })

    it('displays correct indicators for each status', () => {
      const projectAllComplete = {
        ...mockProject,
        requirements_status: 'reviewed',
        prd_status: 'ready',
        stories_status: 'refined',
        mockups_status: 'generated',
        export_status: 'exported'
      }
      renderWithRouter(<ProjectCard {...defaultProps} project={projectAllComplete} />)

      // Complete stages show filled dot (●)
      const reqDot = screen.getByLabelText('Requirements: complete')
      expect(reqDot.textContent).toBe('●')
    })

    it('displays half-filled indicator for in_progress status', () => {
      renderWithRouter(<ProjectCard {...defaultProps} />)
      // PRD is draft which maps to in_progress
      const prdDot = screen.getByLabelText('PRD: in progress')
      expect(prdDot.textContent).toBe('◐')
    })

    it('displays empty indicator for empty status', () => {
      renderWithRouter(<ProjectCard {...defaultProps} />)
      const storiesDot = screen.getByLabelText('User Stories: empty')
      expect(storiesDot.textContent).toBe('○')
    })
  })

  describe('Current Stage Badge', () => {
    it('displays current stage badge for first incomplete stage', () => {
      renderWithRouter(<ProjectCard {...defaultProps} />)
      // Requirements complete, PRD in progress, so PRD should be current stage
      expect(screen.getByText('PRD')).toBeInTheDocument()
    })

    it('shows Requirements stage when all are empty', () => {
      const emptyProject = {
        ...mockProject,
        requirements_status: 'empty',
        prd_status: 'empty',
        stories_status: 'empty',
        mockups_status: 'empty',
        export_status: 'not_exported'
      }
      renderWithRouter(<ProjectCard {...defaultProps} project={emptyProject} />)
      expect(screen.getByText('Requirements')).toBeInTheDocument()
    })

    it('shows Export stage when all complete', () => {
      const completeProject = {
        ...mockProject,
        requirements_status: 'reviewed',
        prd_status: 'ready',
        stories_status: 'refined',
        mockups_status: 'generated',
        export_status: 'exported'
      }
      renderWithRouter(<ProjectCard {...defaultProps} project={completeProject} />)
      expect(screen.getByText('Export')).toBeInTheDocument()
    })

    it('shows User Stories stage when PRD is complete but stories empty', () => {
      const storiesStage = {
        ...mockProject,
        requirements_status: 'reviewed',
        prd_status: 'ready',
        stories_status: 'empty',
        mockups_status: 'empty',
        export_status: 'not_exported'
      }
      renderWithRouter(<ProjectCard {...defaultProps} project={storiesStage} />)
      expect(screen.getByText('User Stories')).toBeInTheDocument()
    })

    it('shows Mockups stage when stories are refined', () => {
      const mockupsStage = {
        ...mockProject,
        requirements_status: 'reviewed',
        prd_status: 'ready',
        stories_status: 'refined',
        mockups_status: 'empty',
        export_status: 'not_exported'
      }
      renderWithRouter(<ProjectCard {...defaultProps} project={mockupsStage} />)
      expect(screen.getByText('Mockups')).toBeInTheDocument()
    })
  })

  describe('Progress Percentage', () => {
    it('displays progress percentage', () => {
      renderWithRouter(<ProjectCard {...defaultProps} />)
      expect(screen.getByText('45%')).toBeInTheDocument()
    })

    it('displays 0% when progress is 0', () => {
      const projectZeroProgress = {
        ...mockProject,
        progress: 0
      }
      renderWithRouter(<ProjectCard {...defaultProps} project={projectZeroProgress} />)
      expect(screen.getByText('0%')).toBeInTheDocument()
    })

    it('displays 100% when progress is 100', () => {
      const projectCompleteProgress = {
        ...mockProject,
        progress: 100
      }
      renderWithRouter(<ProjectCard {...defaultProps} project={projectCompleteProgress} />)
      expect(screen.getByText('100%')).toBeInTheDocument()
    })

    it('displays 0% when progress is undefined', () => {
      const projectNoProgress = {
        ...mockProject,
        progress: undefined
      }
      renderWithRouter(<ProjectCard {...defaultProps} project={projectNoProgress} />)
      expect(screen.getByText('0%')).toBeInTheDocument()
    })

    it('displays 0% when progress is null', () => {
      const projectNullProgress = {
        ...mockProject,
        progress: null
      }
      renderWithRouter(<ProjectCard {...defaultProps} project={projectNullProgress} />)
      expect(screen.getByText('0%')).toBeInTheDocument()
    })
  })

  describe('Timestamp Display', () => {
    it('displays "Updated X ago" from lastActivity prop', () => {
      const mockDate = new Date('2026-01-28T12:00:00Z')
      vi.setSystemTime(mockDate)

      const props = {
        ...defaultProps,
        lastActivity: '2026-01-27T12:00:00Z' // 1 day ago
      }
      renderWithRouter(<ProjectCard {...props} />)
      expect(screen.getByText('Updated 1 day ago')).toBeInTheDocument()

      vi.useRealTimers()
    })

    it('displays "Updated X hours ago" for recent activity', () => {
      const mockDate = new Date('2026-01-28T14:00:00Z')
      vi.setSystemTime(mockDate)

      const props = {
        ...defaultProps,
        lastActivity: '2026-01-28T11:00:00Z' // 3 hours ago
      }
      renderWithRouter(<ProjectCard {...props} />)
      expect(screen.getByText('Updated 3 hours ago')).toBeInTheDocument()

      vi.useRealTimers()
    })

    it('displays "Updated just now" for very recent activity', () => {
      const mockDate = new Date('2026-01-28T12:00:30Z')
      vi.setSystemTime(mockDate)

      const props = {
        ...defaultProps,
        lastActivity: '2026-01-28T12:00:00Z' // 30 seconds ago
      }
      renderWithRouter(<ProjectCard {...props} />)
      expect(screen.getByText('Updated just now')).toBeInTheDocument()

      vi.useRealTimers()
    })

    it('displays "No activity yet" when lastActivity is null', () => {
      const props = {
        ...defaultProps,
        lastActivity: null
      }
      const projectNoUpdatedAt = { ...mockProject, updated_at: null }
      renderWithRouter(<ProjectCard {...props} project={projectNoUpdatedAt} />)
      expect(screen.getByText('No activity yet')).toBeInTheDocument()
    })

    it('falls back to updated_at when lastActivity is not provided', () => {
      const mockDate = new Date('2026-01-28T12:00:00Z')
      vi.setSystemTime(mockDate)

      const props = {
        ...defaultProps,
        lastActivity: undefined
      }
      // updated_at is '2026-01-20T10:00:00Z', about 8 days ago
      renderWithRouter(<ProjectCard {...props} />)
      expect(screen.getByText(/Updated \d+ (day|week)/)).toBeInTheDocument()

      vi.useRealTimers()
    })

    it('uses singular "minute" for 1 minute ago', () => {
      const mockDate = new Date('2026-01-28T12:01:30Z')
      vi.setSystemTime(mockDate)

      const props = {
        ...defaultProps,
        lastActivity: '2026-01-28T12:00:00Z'
      }
      renderWithRouter(<ProjectCard {...props} />)
      expect(screen.getByText('Updated 1 minute ago')).toBeInTheDocument()

      vi.useRealTimers()
    })

    it('uses plural "hours" for multiple hours ago', () => {
      const mockDate = new Date('2026-01-28T15:00:00Z')
      vi.setSystemTime(mockDate)

      const props = {
        ...defaultProps,
        lastActivity: '2026-01-28T12:00:00Z'
      }
      renderWithRouter(<ProjectCard {...props} />)
      expect(screen.getByText('Updated 3 hours ago')).toBeInTheDocument()

      vi.useRealTimers()
    })
  })

  describe('Meeting Count', () => {
    it('renders meeting count', () => {
      renderWithRouter(<ProjectCard {...defaultProps} />)
      expect(screen.getByText('5 meetings')).toBeInTheDocument()
    })

    it('renders singular meeting text for count of 1', () => {
      renderWithRouter(<ProjectCard {...defaultProps} meetingCount={1} />)
      expect(screen.getByText('1 meeting')).toBeInTheDocument()
    })

    it('renders "0 meetings" when meeting count is not provided', () => {
      renderWithRouter(
        <ProjectCard {...defaultProps} meetingCount={undefined} />
      )
      expect(screen.getByText('0 meetings')).toBeInTheDocument()
    })

    it('renders "0 meetings" when meeting count is null', () => {
      renderWithRouter(
        <ProjectCard {...defaultProps} meetingCount={null} />
      )
      expect(screen.getByText('0 meetings')).toBeInTheDocument()
    })
  })

  describe('Card Navigation', () => {
    it('navigates to project detail on card click', () => {
      renderWithRouter(<ProjectCard {...defaultProps} />)
      const card = screen.getByRole('button', { name: /Open project: Test Project/i })
      fireEvent.click(card)
      expect(mockNavigate).toHaveBeenCalledWith('/projects/123e4567-e89b-12d3-a456-426614174000')
    })

    it('navigates on Enter key press', () => {
      renderWithRouter(<ProjectCard {...defaultProps} />)
      const card = screen.getByRole('button', { name: /Open project: Test Project/i })
      fireEvent.keyDown(card, { key: 'Enter' })
      expect(mockNavigate).toHaveBeenCalledWith('/projects/123e4567-e89b-12d3-a456-426614174000')
    })

    it('navigates on Space key press', () => {
      renderWithRouter(<ProjectCard {...defaultProps} />)
      const card = screen.getByRole('button', { name: /Open project: Test Project/i })
      fireEvent.keyDown(card, { key: ' ' })
      expect(mockNavigate).toHaveBeenCalledWith('/projects/123e4567-e89b-12d3-a456-426614174000')
    })

    it('does not navigate on other key presses', () => {
      renderWithRouter(<ProjectCard {...defaultProps} />)
      const card = screen.getByRole('button', { name: /Open project: Test Project/i })
      fireEvent.keyDown(card, { key: 'Tab' })
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('card is focusable with tabIndex', () => {
      renderWithRouter(<ProjectCard {...defaultProps} />)
      const card = screen.getByRole('button', { name: /Open project: Test Project/i })
      expect(card).toHaveAttribute('tabindex', '0')
    })
  })

  describe('Edit and Delete Actions', () => {
    it('calls onEdit when edit button is clicked', () => {
      renderWithRouter(<ProjectCard {...defaultProps} />)
      const editButton = screen.getByRole('button', { name: 'Edit project' })
      fireEvent.click(editButton)
      expect(defaultProps.onEdit).toHaveBeenCalledWith(mockProject)
    })

    it('edit button click does not trigger card navigation', () => {
      renderWithRouter(<ProjectCard {...defaultProps} />)
      const editButton = screen.getByRole('button', { name: 'Edit project' })
      fireEvent.click(editButton)
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('calls onDelete when delete button is clicked', () => {
      renderWithRouter(<ProjectCard {...defaultProps} />)
      const deleteButton = screen.getByRole('button', { name: 'Delete project' })
      fireEvent.click(deleteButton)
      expect(defaultProps.onDelete).toHaveBeenCalledWith(mockProject)
    })

    it('delete button click does not trigger card navigation', () => {
      renderWithRouter(<ProjectCard {...defaultProps} />)
      const deleteButton = screen.getByRole('button', { name: 'Delete project' })
      fireEvent.click(deleteButton)
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })

  describe('Archived Project', () => {
    it('shows archived badge when project is archived', () => {
      const archivedProject = {
        ...mockProject,
        archived: true
      }
      renderWithRouter(<ProjectCard {...defaultProps} project={archivedProject} />)
      expect(screen.getByText('Archived')).toBeInTheDocument()
    })

    it('does not show archived badge when project is not archived', () => {
      renderWithRouter(<ProjectCard {...defaultProps} />)
      expect(screen.queryByText('Archived')).not.toBeInTheDocument()
    })

    it('applies archived class to card when project is archived', () => {
      const archivedProject = {
        ...mockProject,
        archived: true
      }
      renderWithRouter(<ProjectCard {...defaultProps} project={archivedProject} />)
      const card = screen.getByRole('button', { name: /Open project: Test Project/i })
      expect(card).toHaveClass('project-card--archived')
    })

    it('does not apply archived class when project is not archived', () => {
      renderWithRouter(<ProjectCard {...defaultProps} />)
      const card = screen.getByRole('button', { name: /Open project: Test Project/i })
      expect(card).not.toHaveClass('project-card--archived')
    })

    it('archived badge has appropriate title attribute', () => {
      const archivedProject = {
        ...mockProject,
        archived: true
      }
      renderWithRouter(<ProjectCard {...defaultProps} project={archivedProject} />)
      const badge = screen.getByText('Archived')
      expect(badge).toHaveAttribute('title', 'Archived')
    })
  })

  describe('Card Structure', () => {
    it('has correct structure with header, description, progress, and footer', () => {
      renderWithRouter(<ProjectCard {...defaultProps} />)

      // Header with name
      expect(screen.getByRole('heading', { name: 'Test Project' })).toBeInTheDocument()

      // Description
      const description = screen.getByText('A test project description that is quite long and should be displayed')
      expect(description).toHaveClass('project-card__description')

      // Mini stepper
      expect(screen.getByLabelText('Stage progress')).toBeInTheDocument()

      // Stage badge
      expect(screen.getByText('PRD')).toHaveClass('project-card__stage-badge')

      // Progress percentage
      expect(screen.getByText('45%')).toHaveClass('project-card__progress-percent')
    })

    it('has proper role attribute for accessibility', () => {
      renderWithRouter(<ProjectCard {...defaultProps} />)
      const card = screen.getByRole('button', { name: /Open project: Test Project/i })
      expect(card).toBeInTheDocument()
    })

    it('has proper aria-label for accessibility', () => {
      renderWithRouter(<ProjectCard {...defaultProps} />)
      const card = screen.getByRole('button', { name: 'Open project: Test Project' })
      expect(card).toBeInTheDocument()
    })
  })

  describe('Various Project States', () => {
    it('handles project with has_items requirements status', () => {
      const project = {
        ...mockProject,
        requirements_status: 'has_items'
      }
      renderWithRouter(<ProjectCard {...defaultProps} project={project} />)
      const reqDot = screen.getByLabelText('Requirements: in progress')
      expect(reqDot).toHaveClass('project-card__mini-stepper-dot--in_progress')
    })

    it('handles project with generated stories status', () => {
      const project = {
        ...mockProject,
        stories_status: 'generated'
      }
      renderWithRouter(<ProjectCard {...defaultProps} project={project} />)
      const storiesDot = screen.getByLabelText('User Stories: in progress')
      expect(storiesDot).toHaveClass('project-card__mini-stepper-dot--in_progress')
    })

    it('handles project with generated mockups status', () => {
      const project = {
        ...mockProject,
        mockups_status: 'generated'
      }
      renderWithRouter(<ProjectCard {...defaultProps} project={project} />)
      const mockupsDot = screen.getByLabelText('Mockups: complete')
      expect(mockupsDot).toHaveClass('project-card__mini-stepper-dot--complete')
    })

    it('handles project with exported export status', () => {
      const project = {
        ...mockProject,
        export_status: 'exported'
      }
      renderWithRouter(<ProjectCard {...defaultProps} project={project} />)
      const exportDot = screen.getByLabelText('Export: complete')
      expect(exportDot).toHaveClass('project-card__mini-stepper-dot--complete')
    })

    it('handles project with all stages complete', () => {
      const completeProject = {
        ...mockProject,
        requirements_status: 'reviewed',
        prd_status: 'ready',
        stories_status: 'refined',
        mockups_status: 'generated',
        export_status: 'exported',
        progress: 100
      }
      renderWithRouter(<ProjectCard {...defaultProps} project={completeProject} />)

      expect(screen.getByLabelText('Requirements: complete')).toBeInTheDocument()
      expect(screen.getByLabelText('PRD: complete')).toBeInTheDocument()
      expect(screen.getByLabelText('User Stories: complete')).toBeInTheDocument()
      expect(screen.getByLabelText('Mockups: complete')).toBeInTheDocument()
      expect(screen.getByLabelText('Export: complete')).toBeInTheDocument()
      expect(screen.getByText('100%')).toBeInTheDocument()
    })

    it('handles project with all stages empty', () => {
      const emptyProject = {
        ...mockProject,
        requirements_status: 'empty',
        prd_status: 'empty',
        stories_status: 'empty',
        mockups_status: 'empty',
        export_status: 'not_exported',
        progress: 0
      }
      renderWithRouter(<ProjectCard {...defaultProps} project={emptyProject} />)

      expect(screen.getByLabelText('Requirements: empty')).toBeInTheDocument()
      expect(screen.getByLabelText('PRD: empty')).toBeInTheDocument()
      expect(screen.getByLabelText('User Stories: empty')).toBeInTheDocument()
      expect(screen.getByLabelText('Mockups: empty')).toBeInTheDocument()
      expect(screen.getByLabelText('Export: empty')).toBeInTheDocument()
      expect(screen.getByText('0%')).toBeInTheDocument()
    })

    it('handles project with missing status fields gracefully', () => {
      const minimalProject = {
        id: '123',
        name: 'Minimal Project',
        description: 'Test'
      }
      renderWithRouter(<ProjectCard {...defaultProps} project={minimalProject} />)

      // Should default to empty status for all stages
      expect(screen.getByLabelText('Requirements: empty')).toBeInTheDocument()
      expect(screen.getByText('Requirements')).toBeInTheDocument() // Current stage
      expect(screen.getByText('0%')).toBeInTheDocument()
    })
  })
})
