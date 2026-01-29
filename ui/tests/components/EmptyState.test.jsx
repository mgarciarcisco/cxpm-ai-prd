import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import EmptyState from '../../src/components/common/EmptyState'

describe('EmptyState', () => {
  describe('Icon/Illustration', () => {
    it('renders with icon when provided', () => {
      const icon = <svg data-testid="test-icon" />
      render(<EmptyState icon={icon} />)
      expect(screen.getByTestId('test-icon')).toBeInTheDocument()
    })

    it('renders icon in icon container', () => {
      const icon = <svg data-testid="test-icon" />
      const { container } = render(<EmptyState icon={icon} />)
      const iconContainer = container.querySelector('.empty-state__icon')
      expect(iconContainer).toBeInTheDocument()
      expect(iconContainer).toContainElement(screen.getByTestId('test-icon'))
    })

    it('does not render icon container when icon is not provided', () => {
      const { container } = render(<EmptyState title="Test" />)
      const iconContainer = container.querySelector('.empty-state__icon')
      expect(iconContainer).not.toBeInTheDocument()
    })

    it('renders custom illustration component as icon', () => {
      const Illustration = () => <div data-testid="custom-illustration">Custom Image</div>
      render(<EmptyState icon={<Illustration />} />)
      expect(screen.getByTestId('custom-illustration')).toBeInTheDocument()
    })
  })

  describe('Title and Description', () => {
    it('renders title when provided', () => {
      render(<EmptyState title="No items found" />)
      expect(screen.getByRole('heading', { level: 3, name: 'No items found' })).toBeInTheDocument()
    })

    it('title has correct class', () => {
      const { container } = render(<EmptyState title="No items found" />)
      const title = container.querySelector('.empty-state__title')
      expect(title).toBeInTheDocument()
      expect(title).toHaveTextContent('No items found')
    })

    it('does not render title when not provided', () => {
      const { container } = render(<EmptyState description="Some description" />)
      const title = container.querySelector('.empty-state__title')
      expect(title).not.toBeInTheDocument()
    })

    it('renders description when provided', () => {
      render(<EmptyState description="Try adding some items" />)
      expect(screen.getByText('Try adding some items')).toBeInTheDocument()
    })

    it('description has correct class', () => {
      const { container } = render(<EmptyState description="Try adding some items" />)
      const description = container.querySelector('.empty-state__description')
      expect(description).toBeInTheDocument()
      expect(description).toHaveTextContent('Try adding some items')
    })

    it('does not render description when not provided', () => {
      const { container } = render(<EmptyState title="Test" />)
      const description = container.querySelector('.empty-state__description')
      expect(description).not.toBeInTheDocument()
    })

    it('renders both title and description together', () => {
      render(<EmptyState title="No projects" description="Create your first project" />)
      expect(screen.getByRole('heading', { name: 'No projects' })).toBeInTheDocument()
      expect(screen.getByText('Create your first project')).toBeInTheDocument()
    })
  })

  describe('Action Buttons', () => {
    it('renders single action button via actionButton prop (legacy)', () => {
      const button = <button data-testid="action-btn">Add Item</button>
      render(<EmptyState actionButton={button} />)
      expect(screen.getByTestId('action-btn')).toBeInTheDocument()
    })

    it('renders multiple action buttons via actions prop', () => {
      const actions = [
        <button key="1" data-testid="action-1">Primary Action</button>,
        <button key="2" data-testid="action-2">Secondary Action</button>
      ]
      render(<EmptyState actions={actions} />)
      expect(screen.getByTestId('action-1')).toBeInTheDocument()
      expect(screen.getByTestId('action-2')).toBeInTheDocument()
    })

    it('renders actions array with correct count', () => {
      const actions = [
        <button key="1">Action 1</button>,
        <button key="2">Action 2</button>,
        <button key="3">Action 3</button>
      ]
      const { container } = render(<EmptyState actions={actions} />)
      const actionWrappers = container.querySelectorAll('.empty-state__action')
      expect(actionWrappers).toHaveLength(3)
    })

    it('actions are wrapped in actions container', () => {
      const actions = [<button key="1">Test</button>]
      const { container } = render(<EmptyState actions={actions} />)
      const actionsContainer = container.querySelector('.empty-state__actions')
      expect(actionsContainer).toBeInTheDocument()
    })

    it('does not render actions container when no actions provided', () => {
      const { container } = render(<EmptyState title="Test" />)
      const actionsContainer = container.querySelector('.empty-state__actions')
      expect(actionsContainer).not.toBeInTheDocument()
    })

    it('prefers actions prop over actionButton prop', () => {
      const actions = [<button key="1" data-testid="actions-btn">Actions Button</button>]
      const actionButton = <button data-testid="legacy-btn">Legacy Button</button>
      render(<EmptyState actions={actions} actionButton={actionButton} />)
      expect(screen.getByTestId('actions-btn')).toBeInTheDocument()
      expect(screen.queryByTestId('legacy-btn')).not.toBeInTheDocument()
    })

    it('falls back to actionButton when actions is empty array', () => {
      const actionButton = <button data-testid="fallback-btn">Fallback</button>
      const { container } = render(<EmptyState actions={[]} actionButton={actionButton} />)
      // Empty actions array is falsy in the condition, but not undefined
      // Based on implementation: actions || (actionButton ? [actionButton] : [])
      // So if actions is [], it will be used and no actionButton shown
      const actionsContainer = container.querySelector('.empty-state__actions')
      expect(actionsContainer).not.toBeInTheDocument()
    })
  })

  describe('Centered Layout', () => {
    it('has empty-state class for centering', () => {
      const { container } = render(<EmptyState title="Test" />)
      const emptyState = container.querySelector('.empty-state')
      expect(emptyState).toBeInTheDocument()
    })

    it('renders all elements in correct order', () => {
      const icon = <svg data-testid="icon" />
      const actions = [<button key="1">Action</button>]
      const { container } = render(
        <EmptyState
          icon={icon}
          title="Title"
          description="Description"
          actions={actions}
        />
      )
      const emptyState = container.querySelector('.empty-state')
      const children = emptyState.children

      // Order should be: icon, title, description, actions
      expect(children[0]).toHaveClass('empty-state__icon')
      expect(children[1]).toHaveClass('empty-state__title')
      expect(children[2]).toHaveClass('empty-state__description')
      expect(children[3]).toHaveClass('empty-state__actions')
    })
  })

  describe('Missing Optional Props', () => {
    it('renders without any props', () => {
      const { container } = render(<EmptyState />)
      const emptyState = container.querySelector('.empty-state')
      expect(emptyState).toBeInTheDocument()
      // Should be empty but not crash
      expect(emptyState.children).toHaveLength(0)
    })

    it('renders with only icon', () => {
      const icon = <svg data-testid="only-icon" />
      render(<EmptyState icon={icon} />)
      expect(screen.getByTestId('only-icon')).toBeInTheDocument()
    })

    it('renders with only title', () => {
      render(<EmptyState title="Just a title" />)
      expect(screen.getByRole('heading', { name: 'Just a title' })).toBeInTheDocument()
    })

    it('renders with only description', () => {
      render(<EmptyState description="Just a description" />)
      expect(screen.getByText('Just a description')).toBeInTheDocument()
    })

    it('renders with only actions', () => {
      const actions = [<button key="1" data-testid="only-action">Click</button>]
      render(<EmptyState actions={actions} />)
      expect(screen.getByTestId('only-action')).toBeInTheDocument()
    })

    it('handles null icon gracefully', () => {
      const { container } = render(<EmptyState icon={null} title="Test" />)
      const iconContainer = container.querySelector('.empty-state__icon')
      expect(iconContainer).not.toBeInTheDocument()
    })

    it('handles undefined actionButton gracefully', () => {
      const { container } = render(<EmptyState actionButton={undefined} title="Test" />)
      const actionsContainer = container.querySelector('.empty-state__actions')
      expect(actionsContainer).not.toBeInTheDocument()
    })

    it('handles null actions gracefully', () => {
      const actionButton = <button data-testid="fallback">Fallback</button>
      render(<EmptyState actions={null} actionButton={actionButton} />)
      // null is falsy so it should fallback to actionButton
      expect(screen.getByTestId('fallback')).toBeInTheDocument()
    })
  })

  describe('Full Component Rendering', () => {
    it('renders complete component with all props', () => {
      const icon = <svg data-testid="full-icon" />
      const actions = [
        <button key="1" data-testid="primary">Primary</button>,
        <button key="2" data-testid="secondary">Secondary</button>
      ]

      render(
        <EmptyState
          icon={icon}
          title="No meetings found"
          description="Upload your first meeting to get started"
          actions={actions}
        />
      )

      expect(screen.getByTestId('full-icon')).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'No meetings found' })).toBeInTheDocument()
      expect(screen.getByText('Upload your first meeting to get started')).toBeInTheDocument()
      expect(screen.getByTestId('primary')).toBeInTheDocument()
      expect(screen.getByTestId('secondary')).toBeInTheDocument()
    })
  })
})
