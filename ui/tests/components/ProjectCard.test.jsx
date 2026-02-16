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

describe('ProjectCard', () => {
  const mockProject = {
    id: '123',
    name: 'Test Project',
    description: 'A test project description that is quite long and should be displayed',
    requirements_status: 'reviewed',
    prd_status: 'draft',
    stories_status: 'empty',
    mockups_status: 'empty',
    export_status: 'not_exported',
    updated_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() // 1 week ago
  }

  const defaultProps = {
    project: mockProject,
    onEdit: vi.fn(),
    onDelete: vi.fn()
  }

  const renderWithRouter = (ui) => {
    return render(
      <MemoryRouter>
        {ui}
      </MemoryRouter>
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockClear()
  })

  describe('Basic Rendering', () => {
    it('renders project name', () => {
      renderWithRouter(<ProjectCard {...defaultProps} />)
      expect(screen.getByText('Test Project')).toBeInTheDocument()
    })

    it('renders project description', () => {
      renderWithRouter(<ProjectCard {...defaultProps} />)
      expect(screen.getByText('A test project description that is quite long and should be displayed')).toBeInTheDocument()
    })

    it('displays updated time', () => {
      renderWithRouter(<ProjectCard {...defaultProps} />)
      expect(screen.getByText('Updated 1w ago')).toBeInTheDocument()
    })
  })

  describe('Actions', () => {
    it('renders edit button', () => {
      renderWithRouter(<ProjectCard {...defaultProps} />)
      expect(screen.getByRole('button', { name: 'Edit project' })).toBeInTheDocument()
    })

    it('renders delete button', () => {
      renderWithRouter(<ProjectCard {...defaultProps} />)
      expect(screen.getByRole('button', { name: 'Delete project' })).toBeInTheDocument()
    })

    it('calls onEdit when edit button clicked', () => {
      renderWithRouter(<ProjectCard {...defaultProps} />)
      fireEvent.click(screen.getByRole('button', { name: 'Edit project' }))
      expect(defaultProps.onEdit).toHaveBeenCalledWith(mockProject)
    })

    it('calls onDelete when delete button clicked', () => {
      renderWithRouter(<ProjectCard {...defaultProps} />)
      fireEvent.click(screen.getByRole('button', { name: 'Delete project' }))
      expect(defaultProps.onDelete).toHaveBeenCalledWith(mockProject)
    })

    it('navigates to project page when card clicked', () => {
      renderWithRouter(<ProjectCard {...defaultProps} />)
      const card = screen.getByRole('button', { name: 'Open project: Test Project' })
      fireEvent.click(card)
      expect(mockNavigate).toHaveBeenCalledWith('/projects/123')
    })

    it('navigates on Enter key press', () => {
      renderWithRouter(<ProjectCard {...defaultProps} />)
      const card = screen.getByRole('button', { name: 'Open project: Test Project' })
      fireEvent.keyDown(card, { key: 'Enter' })
      expect(mockNavigate).toHaveBeenCalledWith('/projects/123')
    })
  })

  describe('Archived State', () => {
    it('shows archived badge when project is archived', () => {
      const archivedProject = {
        ...mockProject,
        archived: true
      }
      renderWithRouter(<ProjectCard {...defaultProps} project={archivedProject} />)
      expect(screen.getByText('Archived')).toBeInTheDocument()
    })

    it('applies archived class when project is archived', () => {
      const archivedProject = {
        ...mockProject,
        archived: true
      }
      const { container } = renderWithRouter(<ProjectCard {...defaultProps} project={archivedProject} />)
      expect(container.querySelector('.project-card--archived')).toBeInTheDocument()
    })
  })
})
