import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import NotificationBell from '../../src/components/common/NotificationBell'

// Need to store mock fn reference so tests can change return values
const mockUseNotifications = vi.fn()

vi.mock('../../src/contexts/NotificationContext', () => ({
  useNotifications: (...args) => mockUseNotifications(...args),
}))

vi.mock('../../src/components/common/NotificationDropdown', () => ({
  default: ({ onClose }) => (
    <div data-testid="notification-dropdown">
      <button onClick={onClose} data-testid="dropdown-close">Close</button>
    </div>
  ),
}))

// NotificationDropdown uses these internally, mock them to prevent import errors
vi.mock('../../src/services/api', () => ({
  getNotifications: vi.fn().mockResolvedValue({ items: [], total: 0 }),
}))

const renderBell = () => render(
  <BrowserRouter>
    <NotificationBell />
  </BrowserRouter>
)

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseNotifications.mockReturnValue({
      unreadCount: 0,
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
      refreshNotifications: vi.fn(),
    })
  })

  it('renders bell button', () => {
    renderBell()
    const button = screen.getByRole('button', { name: /notifications/i })
    expect(button).toBeInTheDocument()
  })

  it('has the notification-bell__button class', () => {
    renderBell()
    const button = screen.getByRole('button', { name: /notifications/i })
    expect(button).toHaveClass('notification-bell__button')
  })

  it('does NOT show badge when unreadCount is 0', () => {
    mockUseNotifications.mockReturnValue({
      unreadCount: 0,
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
      refreshNotifications: vi.fn(),
    })
    const { container } = renderBell()
    const badge = container.querySelector('.notification-bell__badge')
    expect(badge).not.toBeInTheDocument()
  })

  it('shows badge with count when unreadCount > 0', () => {
    mockUseNotifications.mockReturnValue({
      unreadCount: 5,
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
      refreshNotifications: vi.fn(),
    })
    const { container } = renderBell()
    const badge = container.querySelector('.notification-bell__badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent('5')
  })

  it('shows 99+ when unreadCount exceeds 99', () => {
    mockUseNotifications.mockReturnValue({
      unreadCount: 150,
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
      refreshNotifications: vi.fn(),
    })
    const { container } = renderBell()
    const badge = container.querySelector('.notification-bell__badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent('99+')
  })

  it('has correct aria-label when no unread', () => {
    renderBell()
    expect(screen.getByLabelText('Notifications')).toBeInTheDocument()
  })

  it('has correct aria-label with unread count', () => {
    mockUseNotifications.mockReturnValue({
      unreadCount: 3,
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
      refreshNotifications: vi.fn(),
    })
    renderBell()
    expect(screen.getByLabelText('Notifications (3 unread)')).toBeInTheDocument()
  })

  it('does NOT show dropdown by default', () => {
    renderBell()
    expect(screen.queryByTestId('notification-dropdown')).not.toBeInTheDocument()
  })

  it('opens dropdown on click', async () => {
    const user = userEvent.setup()
    renderBell()

    await user.click(screen.getByRole('button', { name: /notifications/i }))

    expect(screen.getByTestId('notification-dropdown')).toBeInTheDocument()
  })

  it('closes dropdown when clicking button again (toggle)', async () => {
    const user = userEvent.setup()
    renderBell()

    const button = screen.getByRole('button', { name: /notifications/i })

    // Open
    await user.click(button)
    expect(screen.getByTestId('notification-dropdown')).toBeInTheDocument()

    // Close
    await user.click(button)
    await waitFor(() => {
      expect(screen.queryByTestId('notification-dropdown')).not.toBeInTheDocument()
    })
  })

  it('closes dropdown when onClose is called', async () => {
    const user = userEvent.setup()
    renderBell()

    // Open dropdown
    await user.click(screen.getByRole('button', { name: /notifications/i }))
    expect(screen.getByTestId('notification-dropdown')).toBeInTheDocument()

    // Close via dropdown's onClose
    await user.click(screen.getByTestId('dropdown-close'))

    await waitFor(() => {
      expect(screen.queryByTestId('notification-dropdown')).not.toBeInTheDocument()
    })
  })

  it('closes dropdown on outside click', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <BrowserRouter>
        <div data-testid="outside-area">Outside</div>
        <NotificationBell />
      </BrowserRouter>
    )

    // Open dropdown
    await user.click(screen.getByRole('button', { name: /notifications/i }))
    expect(screen.getByTestId('notification-dropdown')).toBeInTheDocument()

    // Click outside
    await user.click(screen.getByTestId('outside-area'))

    await waitFor(() => {
      expect(screen.queryByTestId('notification-dropdown')).not.toBeInTheDocument()
    })
  })

  it('closes dropdown on Escape key', async () => {
    const user = userEvent.setup()
    renderBell()

    // Open dropdown
    await user.click(screen.getByRole('button', { name: /notifications/i }))
    expect(screen.getByTestId('notification-dropdown')).toBeInTheDocument()

    // Press Escape
    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByTestId('notification-dropdown')).not.toBeInTheDocument()
    })
  })

  it('renders SVG bell icon', () => {
    renderBell()
    const button = screen.getByRole('button', { name: /notifications/i })
    const svg = button.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })
})
