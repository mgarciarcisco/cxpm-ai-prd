import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BugReportButton from '../../src/components/common/BugReportButton'

// Mock BugReportModal since BugReportButton renders it conditionally
vi.mock('../../src/components/common/BugReportModal', () => ({
  default: ({ onClose }) => (
    <div data-testid="bug-report-modal">
      <span>Report a Bug</span>
      <button onClick={onClose} data-testid="modal-close">Close</button>
    </div>
  ),
}))

// BugReportModal internally uses these, but since we mock the whole modal, these
// are only needed if the real modal were rendered. Including them prevents import errors.
vi.mock('../../src/components/common/Modal', () => ({
  Modal: ({ children, onClose, title }) => (
    <div data-testid="mock-modal" data-title={title}>
      <button onClick={onClose}>Close</button>
      {children}
    </div>
  ),
}))

vi.mock('../../src/contexts/ToastContext', () => ({
  useToast: () => ({ showSuccess: vi.fn(), showError: vi.fn() }),
}))

vi.mock('../../src/services/api', () => ({
  submitBugReport: vi.fn(),
}))

describe('BugReportButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders a floating button', () => {
    render(<BugReportButton />)
    const button = screen.getByRole('button', { name: 'Report a bug' })
    expect(button).toBeInTheDocument()
  })

  it('button has the bug-report-fab CSS class', () => {
    render(<BugReportButton />)
    const button = screen.getByRole('button', { name: 'Report a bug' })
    expect(button).toHaveClass('bug-report-fab')
  })

  it('has correct title attribute', () => {
    render(<BugReportButton />)
    const button = screen.getByRole('button', { name: 'Report a bug' })
    expect(button).toHaveAttribute('title', 'Report a Bug')
  })

  it('does NOT show the modal by default', () => {
    render(<BugReportButton />)
    expect(screen.queryByTestId('bug-report-modal')).not.toBeInTheDocument()
  })

  it('opens the BugReportModal when button is clicked', async () => {
    const user = userEvent.setup()
    render(<BugReportButton />)

    await user.click(screen.getByRole('button', { name: 'Report a bug' }))

    expect(screen.getByTestId('bug-report-modal')).toBeInTheDocument()
  })

  it('closes the modal when onClose is called', async () => {
    const user = userEvent.setup()
    render(<BugReportButton />)

    // Open the modal
    await user.click(screen.getByRole('button', { name: 'Report a bug' }))
    expect(screen.getByTestId('bug-report-modal')).toBeInTheDocument()

    // Close the modal
    await user.click(screen.getByTestId('modal-close'))

    await waitFor(() => {
      expect(screen.queryByTestId('bug-report-modal')).not.toBeInTheDocument()
    })
  })

  it('can reopen the modal after closing it', async () => {
    const user = userEvent.setup()
    render(<BugReportButton />)

    // Open
    await user.click(screen.getByRole('button', { name: 'Report a bug' }))
    expect(screen.getByTestId('bug-report-modal')).toBeInTheDocument()

    // Close
    await user.click(screen.getByTestId('modal-close'))
    await waitFor(() => {
      expect(screen.queryByTestId('bug-report-modal')).not.toBeInTheDocument()
    })

    // Reopen
    await user.click(screen.getByRole('button', { name: 'Report a bug' }))
    expect(screen.getByTestId('bug-report-modal')).toBeInTheDocument()
  })

  it('renders an SVG icon inside the button', () => {
    render(<BugReportButton />)
    const button = screen.getByRole('button', { name: 'Report a bug' })
    const svg = button.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })
})
