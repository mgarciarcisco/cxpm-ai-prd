import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import NotificationsPage from '../../src/pages/NotificationsPage'

const mockMarkAsRead = vi.fn()
const mockMarkAllAsRead = vi.fn()
const mockRefreshNotifications = vi.fn()

vi.mock('../../src/contexts/NotificationContext', () => ({
  useNotifications: () => ({
    markAsRead: mockMarkAsRead,
    markAllAsRead: mockMarkAllAsRead,
    refreshNotifications: mockRefreshNotifications,
  }),
}))

vi.mock('../../src/services/api', () => ({
  getNotifications: vi.fn(),
}))

import { getNotifications } from '../../src/services/api'

const renderPage = () => render(
  <BrowserRouter>
    <NotificationsPage />
  </BrowserRouter>
)

const sampleNotifications = [
  {
    id: 1,
    type: 'bug_status_change',
    title: 'Bug #123 status changed',
    message: 'Status changed to fixed',
    is_read: false,
    resource_type: 'bug_report',
    resource_id: 123,
    created_at: new Date().toISOString(),
  },
  {
    id: 2,
    type: 'feature_status_change',
    title: 'Feature request approved',
    message: 'Your feature request was approved',
    is_read: true,
    resource_type: 'feature_request',
    resource_id: 456,
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 3,
    type: 'feature_comment',
    title: 'New comment on your request',
    message: null,
    is_read: false,
    resource_type: 'feature_request',
    resource_id: 789,
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
]

describe('NotificationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getNotifications.mockResolvedValue({ items: [], total: 0 })
  })

  describe('Page structure', () => {
    it('renders page title "Notifications"', async () => {
      renderPage()
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: 'Notifications' })).toBeInTheDocument()
      })
    })

    it('renders breadcrumbs with Dashboard link', async () => {
      renderPage()
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
      const dashLink = screen.getByRole('link', { name: 'Dashboard' })
      expect(dashLink).toHaveAttribute('href', '/dashboard')
    })

    it('renders "Mark all as read" button', async () => {
      renderPage()
      expect(screen.getByRole('button', { name: /mark all as read/i })).toBeInTheDocument()
    })

    it('renders filter tabs (All and Unread)', async () => {
      renderPage()
      expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Unread' })).toBeInTheDocument()
    })
  })

  describe('Loading state', () => {
    it('shows loading skeleton initially', () => {
      // Use a never-resolving promise to keep loading state active
      getNotifications.mockReturnValue(new Promise(() => {}))
      const { container } = renderPage()
      const skeleton = container.querySelector('.skeleton-table')
      expect(skeleton).toBeInTheDocument()
    })

    it('shows skeleton rows during loading', () => {
      getNotifications.mockReturnValue(new Promise(() => {}))
      const { container } = renderPage()
      const rows = container.querySelectorAll('.skeleton-row')
      expect(rows.length).toBeGreaterThan(0)
    })
  })

  describe('Empty state', () => {
    it('shows empty state when no notifications (all filter)', async () => {
      getNotifications.mockResolvedValue({ items: [], total: 0 })
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('No notifications yet')).toBeInTheDocument()
      })
    })

    it('shows correct description for empty all notifications', async () => {
      getNotifications.mockResolvedValue({ items: [], total: 0 })
      renderPage()

      await waitFor(() => {
        expect(screen.getByText(/notifications will appear here/i)).toBeInTheDocument()
      })
    })

    it('shows different empty state for unread filter', async () => {
      const user = userEvent.setup()
      getNotifications.mockResolvedValue({ items: [], total: 0 })
      renderPage()

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('No notifications yet')).toBeInTheDocument()
      })

      // Switch to unread filter
      await user.click(screen.getByRole('button', { name: 'Unread' }))

      await waitFor(() => {
        expect(screen.getByText('All caught up!')).toBeInTheDocument()
        expect(screen.getByText('You have no unread notifications.')).toBeInTheDocument()
      })
    })
  })

  describe('Rendering notifications', () => {
    it('renders notification items after loading', async () => {
      getNotifications.mockResolvedValue({ items: sampleNotifications, total: 3 })
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Bug #123 status changed')).toBeInTheDocument()
        expect(screen.getByText('Feature request approved')).toBeInTheDocument()
        expect(screen.getByText('New comment on your request')).toBeInTheDocument()
      })
    })

    it('renders notification messages when present', async () => {
      getNotifications.mockResolvedValue({ items: sampleNotifications, total: 3 })
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Status changed to fixed')).toBeInTheDocument()
        expect(screen.getByText('Your feature request was approved')).toBeInTheDocument()
      })
    })

    it('applies unread styling to unread notifications', async () => {
      getNotifications.mockResolvedValue({ items: sampleNotifications, total: 3 })
      const { container } = renderPage()

      await waitFor(() => {
        const unreadRows = container.querySelectorAll('.notifications-page__row--unread')
        expect(unreadRows.length).toBe(2) // ids 1 and 3 are unread
      })
    })

    it('shows unread dot for unread notifications', async () => {
      getNotifications.mockResolvedValue({ items: sampleNotifications, total: 3 })
      const { container } = renderPage()

      await waitFor(() => {
        const dots = container.querySelectorAll('.notifications-page__unread-dot')
        expect(dots.length).toBe(2)
      })
    })

    it('renders notification time', async () => {
      getNotifications.mockResolvedValue({
        items: [{
          id: 1,
          type: 'feature_comment',
          title: 'Test notification',
          message: null,
          is_read: true,
          resource_type: 'feature_request',
          resource_id: 1,
          created_at: new Date().toISOString(), // Just now
        }],
        total: 1,
      })
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Just now')).toBeInTheDocument()
      })
    })
  })

  describe('Filter tabs', () => {
    it('All tab is active by default', () => {
      getNotifications.mockResolvedValue({ items: [], total: 0 })
      const { container } = renderPage()
      const allTab = screen.getByRole('button', { name: 'All' })
      expect(allTab).toHaveClass('notifications-page__filter-pill--active')
    })

    it('Unread tab becomes active on click', async () => {
      const user = userEvent.setup()
      getNotifications.mockResolvedValue({ items: [], total: 0 })
      renderPage()

      // Wait for initial load
      await waitFor(() => {
        expect(screen.queryByText('.skeleton-table')).not.toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: 'Unread' }))

      await waitFor(() => {
        const unreadTab = screen.getByRole('button', { name: 'Unread' })
        expect(unreadTab).toHaveClass('notifications-page__filter-pill--active')
        const allTab = screen.getByRole('button', { name: 'All' })
        expect(allTab).not.toHaveClass('notifications-page__filter-pill--active')
      })
    })

    it('calls getNotifications with unreadOnly=true when Unread tab clicked', async () => {
      const user = userEvent.setup()
      getNotifications.mockResolvedValue({ items: [], total: 0 })
      renderPage()

      // Wait for initial load
      await waitFor(() => {
        expect(getNotifications).toHaveBeenCalledWith(1, 20, false)
      })

      await user.click(screen.getByRole('button', { name: 'Unread' }))

      await waitFor(() => {
        expect(getNotifications).toHaveBeenCalledWith(1, 20, true)
      })
    })

    it('calls getNotifications with unreadOnly=false when All tab clicked', async () => {
      const user = userEvent.setup()
      getNotifications.mockResolvedValue({ items: [], total: 0 })
      renderPage()

      // Wait for initial load
      await waitFor(() => {
        expect(getNotifications).toHaveBeenCalledWith(1, 20, false)
      })

      // Go to Unread first
      await user.click(screen.getByRole('button', { name: 'Unread' }))
      await waitFor(() => {
        expect(getNotifications).toHaveBeenCalledWith(1, 20, true)
      })

      // Go back to All
      await user.click(screen.getByRole('button', { name: 'All' }))
      await waitFor(() => {
        // Most recent call should be with false again
        const lastCall = getNotifications.mock.calls[getNotifications.mock.calls.length - 1]
        expect(lastCall).toEqual([1, 20, false])
      })
    })
  })

  describe('Mark all as read', () => {
    it('calls markAllAsRead when "Mark all as read" button is clicked', async () => {
      const user = userEvent.setup()
      getNotifications.mockResolvedValue({ items: sampleNotifications, total: 3 })
      mockMarkAllAsRead.mockResolvedValue()

      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Bug #123 status changed')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /mark all as read/i }))

      expect(mockMarkAllAsRead).toHaveBeenCalled()
    })

    it('calls refreshNotifications after marking all as read', async () => {
      const user = userEvent.setup()
      getNotifications.mockResolvedValue({ items: sampleNotifications, total: 3 })
      mockMarkAllAsRead.mockResolvedValue()

      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Bug #123 status changed')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /mark all as read/i }))

      await waitFor(() => {
        expect(mockRefreshNotifications).toHaveBeenCalled()
      })
    })

    it('removes unread styling after marking all as read', async () => {
      const user = userEvent.setup()
      getNotifications.mockResolvedValue({ items: sampleNotifications, total: 3 })
      mockMarkAllAsRead.mockResolvedValue()

      const { container } = renderPage()

      await waitFor(() => {
        expect(container.querySelectorAll('.notifications-page__row--unread').length).toBe(2)
      })

      await user.click(screen.getByRole('button', { name: /mark all as read/i }))

      await waitFor(() => {
        expect(container.querySelectorAll('.notifications-page__row--unread').length).toBe(0)
      })
    })
  })

  describe('Clicking a notification', () => {
    it('calls markAsRead when clicking an unread notification', async () => {
      const user = userEvent.setup()
      getNotifications.mockResolvedValue({ items: sampleNotifications, total: 3 })
      mockMarkAsRead.mockResolvedValue()

      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Bug #123 status changed')).toBeInTheDocument()
      })

      // Click the unread notification (id=1)
      await user.click(screen.getByText('Bug #123 status changed').closest('button'))

      expect(mockMarkAsRead).toHaveBeenCalledWith(1)
    })

    it('does NOT call markAsRead when clicking a read notification', async () => {
      const user = userEvent.setup()
      getNotifications.mockResolvedValue({ items: sampleNotifications, total: 3 })

      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Feature request approved')).toBeInTheDocument()
      })

      // Click the read notification (id=2)
      await user.click(screen.getByText('Feature request approved').closest('button'))

      expect(mockMarkAsRead).not.toHaveBeenCalled()
    })
  })

  describe('Pagination', () => {
    it('does not render pagination when total fits in one page', async () => {
      getNotifications.mockResolvedValue({ items: sampleNotifications, total: 3 })
      const { container } = renderPage()

      await waitFor(() => {
        expect(screen.getByText('Bug #123 status changed')).toBeInTheDocument()
      })

      const pagination = container.querySelector('.pagination')
      expect(pagination).not.toBeInTheDocument()
    })

    it('renders pagination when total exceeds page size', async () => {
      getNotifications.mockResolvedValue({ items: sampleNotifications, total: 45 })
      const { container } = renderPage()

      await waitFor(() => {
        expect(screen.getByText('Bug #123 status changed')).toBeInTheDocument()
      })

      const pagination = container.querySelector('.pagination')
      expect(pagination).toBeInTheDocument()
    })

    it('shows correct pagination info', async () => {
      getNotifications.mockResolvedValue({ items: sampleNotifications, total: 45 })
      renderPage()

      await waitFor(() => {
        expect(screen.getByText(/Showing 1-20 of 45 notifications/)).toBeInTheDocument()
      })
    })

    it('renders correct number of page buttons', async () => {
      getNotifications.mockResolvedValue({ items: sampleNotifications, total: 45 })
      const { container } = renderPage()

      await waitFor(() => {
        const pageButtons = container.querySelectorAll('.pagination__btn')
        expect(pageButtons.length).toBe(3) // 45/20 = 3 pages
      })
    })
  })

  describe('API error handling', () => {
    it('handles API error gracefully (does not crash)', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      getNotifications.mockRejectedValue(new Error('Network error'))
      renderPage()

      await waitFor(() => {
        // Page should still render without crashing
        expect(screen.getByRole('heading', { level: 1, name: 'Notifications' })).toBeInTheDocument()
      })

      consoleSpy.mockRestore()
    })
  })
})
