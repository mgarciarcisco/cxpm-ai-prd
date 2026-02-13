import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import UpvoteButton from '../../src/components/feature-requests/UpvoteButton'

vi.mock('../../src/services/api', () => ({
  toggleUpvote: vi.fn(),
}))

import { toggleUpvote } from '../../src/services/api'

describe('UpvoteButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders count correctly', () => {
    render(<UpvoteButton featureRequestId={1} count={5} upvoted={false} />)
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('renders zero count', () => {
    render(<UpvoteButton featureRequestId={1} count={0} upvoted={false} />)
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('shows upvoted state (active class) when upvoted=true', () => {
    render(<UpvoteButton featureRequestId={1} count={3} upvoted={true} />)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('upvote-btn--active')
  })

  it('shows non-upvoted state when upvoted=false', () => {
    render(<UpvoteButton featureRequestId={1} count={3} upvoted={false} />)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('upvote-btn')
    expect(button).not.toHaveClass('upvote-btn--active')
  })

  it('has correct aria-label when upvoted', () => {
    render(<UpvoteButton featureRequestId={1} count={3} upvoted={true} />)
    expect(screen.getByLabelText('Remove upvote')).toBeInTheDocument()
  })

  it('has correct aria-label when not upvoted', () => {
    render(<UpvoteButton featureRequestId={1} count={3} upvoted={false} />)
    expect(screen.getByLabelText('Upvote')).toBeInTheDocument()
  })

  it('calls toggleUpvote on click with correct ID', async () => {
    const user = userEvent.setup()
    toggleUpvote.mockResolvedValue({ upvoted: true, upvote_count: 6 })

    render(<UpvoteButton featureRequestId={42} count={5} upvoted={false} />)

    await user.click(screen.getByRole('button'))

    expect(toggleUpvote).toHaveBeenCalledWith(42)
  })

  it('optimistically updates count on click (upvote)', async () => {
    const user = userEvent.setup()
    // Use a promise that won't resolve immediately to observe optimistic state
    let resolvePromise
    toggleUpvote.mockReturnValue(new Promise((resolve) => { resolvePromise = resolve }))

    render(<UpvoteButton featureRequestId={1} count={5} upvoted={false} />)

    await user.click(screen.getByRole('button'))

    // Optimistic: count should increase to 6 and button should be active
    expect(screen.getByText('6')).toBeInTheDocument()
    expect(screen.getByRole('button')).toHaveClass('upvote-btn--active')

    // Resolve the API call
    resolvePromise({ upvoted: true, upvote_count: 6 })
  })

  it('optimistically updates count on click (remove upvote)', async () => {
    const user = userEvent.setup()
    let resolvePromise
    toggleUpvote.mockReturnValue(new Promise((resolve) => { resolvePromise = resolve }))

    render(<UpvoteButton featureRequestId={1} count={5} upvoted={true} />)

    await user.click(screen.getByRole('button'))

    // Optimistic: count should decrease to 4 and button should lose active class
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByRole('button')).not.toHaveClass('upvote-btn--active')

    resolvePromise({ upvoted: false, upvote_count: 4 })
  })

  it('reverts optimistic update on API error', async () => {
    const user = userEvent.setup()
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    toggleUpvote.mockRejectedValue(new Error('Network error'))

    render(<UpvoteButton featureRequestId={1} count={5} upvoted={false} />)

    await user.click(screen.getByRole('button'))

    // After error, should revert to original values
    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument()
      expect(screen.getByRole('button')).not.toHaveClass('upvote-btn--active')
    })

    consoleSpy.mockRestore()
  })

  it('is disabled while loading', async () => {
    const user = userEvent.setup()
    let resolvePromise
    toggleUpvote.mockReturnValue(new Promise((resolve) => { resolvePromise = resolve }))

    render(<UpvoteButton featureRequestId={1} count={5} upvoted={false} />)

    await user.click(screen.getByRole('button'))

    // Button should be disabled while API call is pending
    expect(screen.getByRole('button')).toBeDisabled()

    resolvePromise({ upvoted: true, upvote_count: 6 })

    await waitFor(() => {
      expect(screen.getByRole('button')).not.toBeDisabled()
    })
  })

  it('updates state from API response (server count differs from optimistic)', async () => {
    const user = userEvent.setup()
    // Server returns a different count than what optimistic update computed
    toggleUpvote.mockResolvedValue({ upvoted: true, upvote_count: 10 })

    render(<UpvoteButton featureRequestId={1} count={5} upvoted={false} />)

    await user.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByText('10')).toBeInTheDocument()
    })
  })

  it('calls onToggle callback after successful API call', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    const apiResult = { upvoted: true, upvote_count: 6 }
    toggleUpvote.mockResolvedValue(apiResult)

    render(<UpvoteButton featureRequestId={1} count={5} upvoted={false} onToggle={onToggle} />)

    await user.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(onToggle).toHaveBeenCalledWith(apiResult)
    })
  })

  it('does not call onToggle on API error', async () => {
    const user = userEvent.setup()
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onToggle = vi.fn()
    toggleUpvote.mockRejectedValue(new Error('Fail'))

    render(<UpvoteButton featureRequestId={1} count={5} upvoted={false} onToggle={onToggle} />)

    await user.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(onToggle).not.toHaveBeenCalled()
    })

    consoleSpy.mockRestore()
  })

  it('prevents event propagation on click', async () => {
    const user = userEvent.setup()
    toggleUpvote.mockResolvedValue({ upvoted: true, upvote_count: 6 })
    const parentClick = vi.fn()

    render(
      <div onClick={parentClick}>
        <UpvoteButton featureRequestId={1} count={5} upvoted={false} />
      </div>
    )

    await user.click(screen.getByRole('button'))

    // Parent click should not be called since stopPropagation is used
    expect(parentClick).not.toHaveBeenCalled()
  })

  it('renders the count inside the upvote-btn__count span', () => {
    const { container } = render(<UpvoteButton featureRequestId={1} count={7} upvoted={false} />)
    const countSpan = container.querySelector('.upvote-btn__count')
    expect(countSpan).toBeInTheDocument()
    expect(countSpan).toHaveTextContent('7')
  })
})
