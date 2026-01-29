import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StageStepper } from '../../src/components/common/StageStepper'

describe('StageStepper', () => {
  const mockOnStageClick = vi.fn()

  const defaultStatuses = {
    requirements: 'empty',
    prd: 'empty',
    stories: 'empty',
    mockups: 'empty',
    export: 'empty'
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('renders all 5 default stages', () => {
      render(<StageStepper statuses={defaultStatuses} />)
      
      expect(screen.getByText('Requirements')).toBeInTheDocument()
      expect(screen.getByText('PRD')).toBeInTheDocument()
      expect(screen.getByText('Stories')).toBeInTheDocument()
      expect(screen.getByText('Mockups')).toBeInTheDocument()
      expect(screen.getByText('Export')).toBeInTheDocument()
    })

    it('renders with navigation landmark', () => {
      render(<StageStepper statuses={defaultStatuses} />)
      expect(screen.getByRole('navigation', { name: 'Project stages' })).toBeInTheDocument()
    })

    it('renders stages as buttons', () => {
      render(<StageStepper statuses={defaultStatuses} />)
      const buttons = screen.getAllByRole('button')
      expect(buttons).toHaveLength(5)
    })
  })

  describe('Status Display', () => {
    it('shows Pending status for empty stages', () => {
      render(<StageStepper statuses={defaultStatuses} />)
      const pendingStatuses = screen.getAllByText('Pending')
      expect(pendingStatuses).toHaveLength(5)
    })

    it('shows Complete status for complete stages', () => {
      const statuses = { ...defaultStatuses, requirements: 'complete' }
      render(<StageStepper statuses={statuses} />)
      expect(screen.getByText('Complete')).toBeInTheDocument()
    })

    it('shows In Progress status for in_progress stages', () => {
      const statuses = { ...defaultStatuses, requirements: 'in_progress' }
      render(<StageStepper statuses={statuses} />)
      expect(screen.getByText('In Progress')).toBeInTheDocument()
    })

    it('shows checkmark for complete stages', () => {
      const statuses = { ...defaultStatuses, requirements: 'complete' }
      render(<StageStepper statuses={statuses} />)
      expect(screen.getByText('✓')).toBeInTheDocument()
    })

    it('shows emoji icons for non-complete stages', () => {
      render(<StageStepper statuses={defaultStatuses} />)
      expect(screen.getByText('📝')).toBeInTheDocument() // Requirements
      expect(screen.getByText('📄')).toBeInTheDocument() // PRD
    })
  })

  describe('Aria Labels', () => {
    it('has correct aria-label for pending stage', () => {
      render(<StageStepper statuses={defaultStatuses} />)
      expect(screen.getByRole('button', { name: 'Requirements: Pending' })).toBeInTheDocument()
    })

    it('has correct aria-label for complete stage', () => {
      const statuses = { ...defaultStatuses, requirements: 'complete' }
      render(<StageStepper statuses={statuses} />)
      expect(screen.getByRole('button', { name: 'Requirements: Complete' })).toBeInTheDocument()
    })

    it('has correct aria-label for in-progress stage', () => {
      const statuses = { ...defaultStatuses, requirements: 'in_progress' }
      render(<StageStepper statuses={statuses} />)
      expect(screen.getByRole('button', { name: 'Requirements: In Progress' })).toBeInTheDocument()
    })
  })

  describe('Current Stage', () => {
    it('marks current stage with aria-current', () => {
      render(
        <StageStepper 
          statuses={defaultStatuses} 
          currentStage="stories" 
        />
      )
      const storiesButton = screen.getByRole('button', { name: /Stories/i })
      expect(storiesButton).toHaveAttribute('aria-current', 'step')
    })

    it('applies current class to current stage', () => {
      render(
        <StageStepper 
          statuses={defaultStatuses} 
          currentStage="prd" 
        />
      )
      const prdButton = screen.getByRole('button', { name: /PRD/i })
      expect(prdButton).toHaveClass('stage-stepper__step--current')
    })
  })

  describe('Click Handling', () => {
    it('calls onStageClick when stage is clicked', () => {
      render(
        <StageStepper 
          statuses={defaultStatuses} 
          onStageClick={mockOnStageClick} 
        />
      )
      
      fireEvent.click(screen.getByRole('button', { name: /Requirements/i }))
      expect(mockOnStageClick).toHaveBeenCalledWith('requirements')
    })

    it('calls onStageClick with correct stage id', () => {
      render(
        <StageStepper 
          statuses={defaultStatuses} 
          onStageClick={mockOnStageClick} 
        />
      )
      
      fireEvent.click(screen.getByRole('button', { name: /Export/i }))
      expect(mockOnStageClick).toHaveBeenCalledWith('export')
    })
  })

  describe('Custom Stages', () => {
    it('renders custom stages when provided', () => {
      const customStages = [
        { id: 'design', label: 'Design', icon: '🎨' },
        { id: 'develop', label: 'Develop', icon: '💻' },
      ]
      
      render(
        <StageStepper 
          stages={customStages} 
          statuses={{ design: 'complete', develop: 'in_progress' }} 
        />
      )
      
      expect(screen.getByText('Design')).toBeInTheDocument()
      expect(screen.getByText('Develop')).toBeInTheDocument()
      expect(screen.queryByText('Requirements')).not.toBeInTheDocument()
    })
  })
})
