import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import ProjectCard from '../../src/components/projects/ProjectCard'

const renderWithRouter = (component) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  )
}

describe('ProjectCard', () => {
  const mockProject = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Project',
    description: 'A test project description'
  }

  const defaultProps = {
    project: mockProject,
    meetingCount: 5,
    lastActivity: '2026-01-20T10:00:00Z',
    onEdit: vi.fn(),
    onDelete: vi.fn()
  }

  it('renders project name', () => {
    renderWithRouter(<ProjectCard {...defaultProps} />)
    expect(screen.getByText('Test Project')).toBeInTheDocument()
  })

  it('renders project description', () => {
    renderWithRouter(<ProjectCard {...defaultProps} />)
    expect(screen.getByText('A test project description')).toBeInTheDocument()
  })

  it('renders "No description" when description is missing', () => {
    const projectWithoutDescription = {
      ...mockProject,
      description: null
    }
    renderWithRouter(
      <ProjectCard {...defaultProps} project={projectWithoutDescription} />
    )
    expect(screen.getByText('No description')).toBeInTheDocument()
  })

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
})
