import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Breadcrumbs from '../../src/components/common/Breadcrumbs'

const renderWithRouter = (component) => {
  return render(
    <MemoryRouter>
      {component}
    </MemoryRouter>
  )
}

describe('Breadcrumbs', () => {
  describe('Breadcrumb Trail', () => {
    it('renders breadcrumb navigation', () => {
      const items = [
        { label: 'Home', href: '/' },
        { label: 'Projects', href: '/projects' },
        { label: 'Current Project' }
      ]
      renderWithRouter(<Breadcrumbs items={items} />)
      expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument()
    })

    it('renders all breadcrumb items', () => {
      const items = [
        { label: 'Home', href: '/' },
        { label: 'Projects', href: '/projects' },
        { label: 'Current Project' }
      ]
      renderWithRouter(<Breadcrumbs items={items} />)
      expect(screen.getByText('Home')).toBeInTheDocument()
      expect(screen.getByText('Projects')).toBeInTheDocument()
      expect(screen.getByText('Current Project')).toBeInTheDocument()
    })

    it('renders items in an ordered list', () => {
      const items = [
        { label: 'Home', href: '/' },
        { label: 'Projects' }
      ]
      renderWithRouter(<Breadcrumbs items={items} />)
      const list = screen.getByRole('list')
      expect(list).toHaveClass('breadcrumbs__list')
      const listItems = within(list).getAllByRole('listitem')
      expect(listItems).toHaveLength(2)
    })

    it('renders single item breadcrumb', () => {
      const items = [{ label: 'Home' }]
      renderWithRouter(<Breadcrumbs items={items} />)
      expect(screen.getByText('Home')).toBeInTheDocument()
    })

    it('renders many items correctly', () => {
      const items = [
        { label: 'Level 1', href: '/l1' },
        { label: 'Level 2', href: '/l2' },
        { label: 'Level 3', href: '/l3' },
        { label: 'Level 4', href: '/l4' },
        { label: 'Level 5' }
      ]
      renderWithRouter(<Breadcrumbs items={items} />)
      const list = screen.getByRole('list')
      const listItems = within(list).getAllByRole('listitem')
      expect(listItems).toHaveLength(5)
    })
  })

  describe('Clickable Links', () => {
    it('all items except last are clickable links', () => {
      const items = [
        { label: 'Home', href: '/' },
        { label: 'Projects', href: '/projects' },
        { label: 'Current Project' }
      ]
      renderWithRouter(<Breadcrumbs items={items} />)

      const homeLink = screen.getByRole('link', { name: 'Home' })
      expect(homeLink).toBeInTheDocument()
      expect(homeLink).toHaveAttribute('href', '/')

      const projectsLink = screen.getByRole('link', { name: 'Projects' })
      expect(projectsLink).toBeInTheDocument()
      expect(projectsLink).toHaveAttribute('href', '/projects')
    })

    it('links have correct CSS class', () => {
      const items = [
        { label: 'Home', href: '/' },
        { label: 'Current' }
      ]
      renderWithRouter(<Breadcrumbs items={items} />)
      const homeLink = screen.getByRole('link', { name: 'Home' })
      expect(homeLink).toHaveClass('breadcrumbs__link')
    })

    it('non-last items without href are not clickable', () => {
      const items = [
        { label: 'Static' },
        { label: 'Current' }
      ]
      renderWithRouter(<Breadcrumbs items={items} />)
      // Static should not be a link since it has no href
      expect(screen.queryByRole('link', { name: 'Static' })).not.toBeInTheDocument()
    })
  })

  describe('Last Item (Non-clickable)', () => {
    it('last item is plain text, not a link', () => {
      const items = [
        { label: 'Home', href: '/' },
        { label: 'Current Page' }
      ]
      renderWithRouter(<Breadcrumbs items={items} />)
      expect(screen.queryByRole('link', { name: 'Current Page' })).not.toBeInTheDocument()
      expect(screen.getByText('Current Page')).toBeInTheDocument()
    })

    it('last item has aria-current="page" attribute', () => {
      const items = [
        { label: 'Home', href: '/' },
        { label: 'Current Page' }
      ]
      renderWithRouter(<Breadcrumbs items={items} />)
      const currentItem = screen.getByText('Current Page')
      expect(currentItem).toHaveAttribute('aria-current', 'page')
    })

    it('last item has correct CSS class', () => {
      const items = [
        { label: 'Home', href: '/' },
        { label: 'Current Page' }
      ]
      renderWithRouter(<Breadcrumbs items={items} />)
      const currentItem = screen.getByText('Current Page')
      expect(currentItem).toHaveClass('breadcrumbs__current')
    })

    it('last item is not a link even if href is provided', () => {
      const items = [
        { label: 'Home', href: '/' },
        { label: 'Current Page', href: '/current' }
      ]
      renderWithRouter(<Breadcrumbs items={items} />)
      // Even with href, last item should not be a link
      expect(screen.queryByRole('link', { name: 'Current Page' })).not.toBeInTheDocument()
    })

    it('single item is treated as last item and not clickable', () => {
      const items = [{ label: 'Only Item', href: '/only' }]
      renderWithRouter(<Breadcrumbs items={items} />)
      expect(screen.queryByRole('link', { name: 'Only Item' })).not.toBeInTheDocument()
      expect(screen.getByText('Only Item')).toHaveClass('breadcrumbs__current')
    })
  })

  describe('Separators', () => {
    it('renders separator between items', () => {
      const items = [
        { label: 'Home', href: '/' },
        { label: 'Projects', href: '/projects' },
        { label: 'Current' }
      ]
      const { container } = renderWithRouter(<Breadcrumbs items={items} />)
      const separators = container.querySelectorAll('.breadcrumbs__separator')
      // Separators appear after each linked item (not after last)
      expect(separators).toHaveLength(2)
    })

    it('separators contain "/" character', () => {
      const items = [
        { label: 'Home', href: '/' },
        { label: 'Current' }
      ]
      const { container } = renderWithRouter(<Breadcrumbs items={items} />)
      const separator = container.querySelector('.breadcrumbs__separator')
      expect(separator).toHaveTextContent('/')
    })

    it('separators have aria-hidden attribute', () => {
      const items = [
        { label: 'Home', href: '/' },
        { label: 'Current' }
      ]
      const { container } = renderWithRouter(<Breadcrumbs items={items} />)
      const separator = container.querySelector('.breadcrumbs__separator')
      expect(separator).toHaveAttribute('aria-hidden', 'true')
    })

    it('no separator after last item', () => {
      const items = [
        { label: 'Home', href: '/' },
        { label: 'Current' }
      ]
      const { container } = renderWithRouter(<Breadcrumbs items={items} />)
      const listItems = container.querySelectorAll('.breadcrumbs__item')
      const lastItem = listItems[listItems.length - 1]
      expect(lastItem.querySelector('.breadcrumbs__separator')).not.toBeInTheDocument()
    })
  })

  describe('Empty and Edge Cases', () => {
    it('returns null when items array is empty', () => {
      const { container } = renderWithRouter(<Breadcrumbs items={[]} />)
      expect(container).toBeEmptyDOMElement()
    })

    it('returns null when items is undefined', () => {
      const { container } = renderWithRouter(<Breadcrumbs />)
      expect(container).toBeEmptyDOMElement()
    })

    it('returns null when items is null', () => {
      const { container } = renderWithRouter(<Breadcrumbs items={null} />)
      expect(container).toBeEmptyDOMElement()
    })
  })

  describe('Responsive Truncation', () => {
    it('links have class for text truncation', () => {
      const items = [
        { label: 'Very Long Label That Should Be Truncated', href: '/long' },
        { label: 'Current' }
      ]
      renderWithRouter(<Breadcrumbs items={items} />)
      const link = screen.getByRole('link', { name: 'Very Long Label That Should Be Truncated' })
      // CSS class should support truncation via text-overflow: ellipsis
      expect(link).toHaveClass('breadcrumbs__link')
    })

    it('current item has class for text truncation', () => {
      const items = [
        { label: 'Home', href: '/' },
        { label: 'Very Long Current Page Label That Should Be Truncated' }
      ]
      renderWithRouter(<Breadcrumbs items={items} />)
      const current = screen.getByText('Very Long Current Page Label That Should Be Truncated')
      expect(current).toHaveClass('breadcrumbs__current')
    })
  })

  describe('Accessibility', () => {
    it('has navigation landmark with aria-label', () => {
      const items = [
        { label: 'Home', href: '/' },
        { label: 'Current' }
      ]
      renderWithRouter(<Breadcrumbs items={items} />)
      const nav = screen.getByRole('navigation', { name: 'Breadcrumb' })
      expect(nav).toHaveAttribute('aria-label', 'Breadcrumb')
    })

    it('uses ordered list for semantic structure', () => {
      const items = [
        { label: 'Home', href: '/' },
        { label: 'Current' }
      ]
      const { container } = renderWithRouter(<Breadcrumbs items={items} />)
      const ol = container.querySelector('ol')
      expect(ol).toBeInTheDocument()
    })
  })

  describe('Component Structure', () => {
    it('has correct root class', () => {
      const items = [{ label: 'Home' }]
      const { container } = renderWithRouter(<Breadcrumbs items={items} />)
      const nav = container.querySelector('.breadcrumbs')
      expect(nav).toBeInTheDocument()
    })

    it('list items have correct class', () => {
      const items = [
        { label: 'Home', href: '/' },
        { label: 'Current' }
      ]
      const { container } = renderWithRouter(<Breadcrumbs items={items} />)
      const listItems = container.querySelectorAll('.breadcrumbs__item')
      expect(listItems).toHaveLength(2)
    })
  })
})
