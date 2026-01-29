import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { StageStepper } from '../../src/components/common/StageStepper'

describe('StageStepper', () => {
  const defaultStatuses = {
    requirements: 'empty',
    prd: 'empty',
    stories: 'empty',
    mockups: 'empty',
    export: 'empty',
  }

  describe('Basic Rendering', () => {
    it('renders all 5 default stages', () => {
      render(<StageStepper statuses={defaultStatuses} />)

      expect(screen.getByText('Requirements')).toBeInTheDocument()
      expect(screen.getByText('PRD')).toBeInTheDocument()
      expect(screen.getByText('User Stories')).toBeInTheDocument()
      expect(screen.getByText('Mockups')).toBeInTheDocument()
      expect(screen.getByText('Export')).toBeInTheDocument()
    })

    it('renders as a navigation element with proper aria-label', () => {
      render(<StageStepper statuses={defaultStatuses} />)

      const nav = screen.getByRole('navigation', { name: 'Project stages' })
      expect(nav).toBeInTheDocument()
    })

    it('renders stages as an ordered list', () => {
      render(<StageStepper statuses={defaultStatuses} />)

      const list = screen.getByRole('list')
      expect(list).toBeInTheDocument()
      expect(list.tagName).toBe('OL')
    })

    it('renders 5 list items', () => {
      render(<StageStepper statuses={defaultStatuses} />)

      const items = screen.getAllByRole('listitem')
      expect(items).toHaveLength(5)
    })

    it('renders each stage as a button', () => {
      render(<StageStepper statuses={defaultStatuses} />)

      const buttons = screen.getAllByRole('button')
      expect(buttons).toHaveLength(5)
    })

    it('renders connectors between stages but not after the last one', () => {
      const { container } = render(<StageStepper statuses={defaultStatuses} />)

      const connectors = container.querySelectorAll('.stage-stepper__connector')
      expect(connectors).toHaveLength(4) // 5 stages = 4 connectors
    })
  })

  describe('Status Indicators', () => {
    it('shows empty indicator (○) for empty status', () => {
      render(<StageStepper statuses={{ requirements: 'empty' }} />)

      const reqButton = screen.getByRole('button', { name: /Requirements/i })
      const indicator = within(reqButton).getByText('○')
      expect(indicator).toBeInTheDocument()
    })

    it('shows in_progress indicator (◐) for in_progress status', () => {
      render(<StageStepper statuses={{ requirements: 'in_progress' }} />)

      const reqButton = screen.getByRole('button', { name: /Requirements/i })
      const indicator = within(reqButton).getByText('◐')
      expect(indicator).toBeInTheDocument()
    })

    it('shows complete indicator (●) for complete status', () => {
      render(<StageStepper statuses={{ requirements: 'complete' }} />)

      const reqButton = screen.getByRole('button', { name: /Requirements/i })
      const indicator = within(reqButton).getByText('●')
      expect(indicator).toBeInTheDocument()
    })

    it('defaults to empty indicator when status is not provided', () => {
      render(<StageStepper statuses={{}} />)

      const reqButton = screen.getByRole('button', { name: /Requirements/i })
      const indicator = within(reqButton).getByText('○')
      expect(indicator).toBeInTheDocument()
    })

    it('shows correct mix of statuses for different stages', () => {
      const mixedStatuses = {
        requirements: 'complete',
        prd: 'complete',
        stories: 'in_progress',
        mockups: 'empty',
        export: 'empty',
      }

      render(<StageStepper statuses={mixedStatuses} />)

      const buttons = screen.getAllByRole('button')

      // Requirements - complete
      expect(within(buttons[0]).getByText('●')).toBeInTheDocument()
      // PRD - complete
      expect(within(buttons[1]).getByText('●')).toBeInTheDocument()
      // Stories - in_progress
      expect(within(buttons[2]).getByText('◐')).toBeInTheDocument()
      // Mockups - empty
      expect(within(buttons[3]).getByText('○')).toBeInTheDocument()
      // Export - empty
      expect(within(buttons[4]).getByText('○')).toBeInTheDocument()
    })

    it('marks indicator as aria-hidden', () => {
      const { container } = render(<StageStepper statuses={defaultStatuses} />)

      const indicators = container.querySelectorAll('.stage-stepper__indicator')
      indicators.forEach(indicator => {
        expect(indicator).toHaveAttribute('aria-hidden', 'true')
      })
    })
  })

  describe('Current Stage Highlighting', () => {
    it('applies current class to the current stage', () => {
      const { container } = render(
        <StageStepper statuses={defaultStatuses} currentStage="prd" />
      )

      const currentStage = container.querySelector('.stage-stepper__stage--current')
      expect(currentStage).toBeInTheDocument()
      expect(within(currentStage).getByText('PRD')).toBeInTheDocument()
    })

    it('sets aria-current="step" on the current stage button', () => {
      render(<StageStepper statuses={defaultStatuses} currentStage="stories" />)

      const storiesButton = screen.getByRole('button', { name: /User Stories/i })
      expect(storiesButton).toHaveAttribute('aria-current', 'step')
    })

    it('does not set aria-current on non-current stages', () => {
      render(<StageStepper statuses={defaultStatuses} currentStage="stories" />)

      const reqButton = screen.getByRole('button', { name: /Requirements/i })
      expect(reqButton).not.toHaveAttribute('aria-current')
    })

    it('does not apply current class when no currentStage is provided', () => {
      const { container } = render(<StageStepper statuses={defaultStatuses} />)

      const currentStages = container.querySelectorAll('.stage-stepper__stage--current')
      expect(currentStages).toHaveLength(0)
    })

    it('highlights each stage correctly when set as current', () => {
      const stages = ['requirements', 'prd', 'stories', 'mockups', 'export']

      stages.forEach(stageId => {
        const { container, unmount } = render(
          <StageStepper statuses={defaultStatuses} currentStage={stageId} />
        )

        const currentStages = container.querySelectorAll('.stage-stepper__stage--current')
        expect(currentStages).toHaveLength(1)

        unmount()
      })
    })
  })

  describe('Click Handlers', () => {
    it('calls onStageClick with stage id when a stage is clicked', () => {
      const onStageClick = vi.fn()
      render(
        <StageStepper
          statuses={defaultStatuses}
          onStageClick={onStageClick}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /Requirements/i }))
      expect(onStageClick).toHaveBeenCalledWith('requirements')
    })

    it('calls onStageClick with correct id for each stage', () => {
      const onStageClick = vi.fn()
      render(
        <StageStepper
          statuses={defaultStatuses}
          onStageClick={onStageClick}
        />
      )

      const expectedIds = ['requirements', 'prd', 'stories', 'mockups', 'export']
      const buttons = screen.getAllByRole('button')

      buttons.forEach((button, index) => {
        fireEvent.click(button)
        expect(onStageClick).toHaveBeenLastCalledWith(expectedIds[index])
      })

      expect(onStageClick).toHaveBeenCalledTimes(5)
    })

    it('does not throw when onStageClick is not provided', () => {
      render(<StageStepper statuses={defaultStatuses} />)

      // Should not throw
      expect(() => {
        fireEvent.click(screen.getByRole('button', { name: /Requirements/i }))
      }).not.toThrow()
    })

    it('does not call anything when onStageClick is undefined', () => {
      render(<StageStepper statuses={defaultStatuses} onStageClick={undefined} />)

      // Should complete without errors
      fireEvent.click(screen.getByRole('button', { name: /Requirements/i }))
      // If we get here, no error was thrown
      expect(true).toBe(true)
    })
  })

  describe('Accessibility', () => {
    it('each button has descriptive aria-label with stage name and status', () => {
      const statuses = {
        requirements: 'complete',
        prd: 'in_progress',
        stories: 'empty',
        mockups: 'empty',
        export: 'empty',
      }

      render(<StageStepper statuses={statuses} />)

      expect(
        screen.getByRole('button', { name: 'Requirements: complete' })
      ).toBeInTheDocument()

      expect(
        screen.getByRole('button', { name: 'PRD: in progress' })
      ).toBeInTheDocument()

      expect(
        screen.getByRole('button', { name: 'User Stories: empty' })
      ).toBeInTheDocument()
    })

    it('connectors have aria-hidden attribute', () => {
      const { container } = render(<StageStepper statuses={defaultStatuses} />)

      const connectors = container.querySelectorAll('.stage-stepper__connector')
      connectors.forEach(connector => {
        expect(connector).toHaveAttribute('aria-hidden', 'true')
      })
    })

    it('all buttons are type="button" (not submit)', () => {
      render(<StageStepper statuses={defaultStatuses} />)

      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        expect(button).toHaveAttribute('type', 'button')
      })
    })
  })

  describe('Status CSS Classes', () => {
    it('applies stage-stepper__stage--empty class for empty status', () => {
      const { container } = render(
        <StageStepper statuses={{ requirements: 'empty' }} />
      )

      const stageButton = container.querySelector('.stage-stepper__stage--empty')
      expect(stageButton).toBeInTheDocument()
    })

    it('applies stage-stepper__stage--in_progress class for in_progress status', () => {
      const { container } = render(
        <StageStepper statuses={{ requirements: 'in_progress' }} />
      )

      const stageButton = container.querySelector('.stage-stepper__stage--in_progress')
      expect(stageButton).toBeInTheDocument()
    })

    it('applies stage-stepper__stage--complete class for complete status', () => {
      const { container } = render(
        <StageStepper statuses={{ requirements: 'complete' }} />
      )

      const stageButton = container.querySelector('.stage-stepper__stage--complete')
      expect(stageButton).toBeInTheDocument()
    })
  })

  describe('Custom Stages', () => {
    const customStages = [
      { id: 'step1', label: 'Step One' },
      { id: 'step2', label: 'Step Two' },
      { id: 'step3', label: 'Step Three' },
    ]

    it('renders custom stages when provided', () => {
      render(
        <StageStepper
          stages={customStages}
          statuses={{ step1: 'complete', step2: 'in_progress', step3: 'empty' }}
        />
      )

      expect(screen.getByText('Step One')).toBeInTheDocument()
      expect(screen.getByText('Step Two')).toBeInTheDocument()
      expect(screen.getByText('Step Three')).toBeInTheDocument()
    })

    it('renders correct number of custom stages', () => {
      render(
        <StageStepper
          stages={customStages}
          statuses={{}}
        />
      )

      const buttons = screen.getAllByRole('button')
      expect(buttons).toHaveLength(3)
    })

    it('renders correct number of connectors for custom stages', () => {
      const { container } = render(
        <StageStepper
          stages={customStages}
          statuses={{}}
        />
      )

      const connectors = container.querySelectorAll('.stage-stepper__connector')
      expect(connectors).toHaveLength(2) // 3 stages = 2 connectors
    })

    it('handles click events for custom stages', () => {
      const onStageClick = vi.fn()
      render(
        <StageStepper
          stages={customStages}
          statuses={{}}
          onStageClick={onStageClick}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /Step Two/i }))
      expect(onStageClick).toHaveBeenCalledWith('step2')
    })
  })

  describe('Default Props', () => {
    it('renders without statuses prop (defaults to empty object)', () => {
      // This should not throw
      render(<StageStepper />)

      // All indicators should be empty
      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        expect(within(button).getByText('○')).toBeInTheDocument()
      })
    })

    it('uses default stages when stages prop is not provided', () => {
      render(<StageStepper />)

      expect(screen.getByText('Requirements')).toBeInTheDocument()
      expect(screen.getByText('PRD')).toBeInTheDocument()
      expect(screen.getByText('User Stories')).toBeInTheDocument()
      expect(screen.getByText('Mockups')).toBeInTheDocument()
      expect(screen.getByText('Export')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('handles unknown status gracefully (defaults to empty)', () => {
      render(<StageStepper statuses={{ requirements: 'unknown_status' }} />)

      const reqButton = screen.getByRole('button', { name: /Requirements/i })
      const indicator = within(reqButton).getByText('○')
      expect(indicator).toBeInTheDocument()
    })

    it('handles undefined statuses prop (defaults to empty object)', () => {
      // The component defaults statuses to {} when undefined
      render(<StageStepper statuses={undefined} />)

      // All should default to empty
      const buttons = screen.getAllByRole('button')
      expect(buttons).toHaveLength(5)
      buttons.forEach(button => {
        expect(within(button).getByText('○')).toBeInTheDocument()
      })
    })

    it('handles empty stages array', () => {
      const { container } = render(<StageStepper stages={[]} statuses={{}} />)

      const buttons = screen.queryAllByRole('button')
      expect(buttons).toHaveLength(0)

      const connectors = container.querySelectorAll('.stage-stepper__connector')
      expect(connectors).toHaveLength(0)
    })

    it('handles single stage', () => {
      const singleStage = [{ id: 'only', label: 'Only Stage' }]
      const { container } = render(
        <StageStepper stages={singleStage} statuses={{ only: 'complete' }} />
      )

      expect(screen.getByText('Only Stage')).toBeInTheDocument()

      // No connectors for single stage
      const connectors = container.querySelectorAll('.stage-stepper__connector')
      expect(connectors).toHaveLength(0)
    })
  })
})
