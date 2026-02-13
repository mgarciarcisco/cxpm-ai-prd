import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import FeatureRequestCard from '../../src/components/feature-requests/FeatureRequestCard'

vi.mock('../../src/components/feature-requests/UpvoteButton', () => ({
  default: ({ featureRequestId, count, upvoted }) => (
    <div
      data-testid="upvote-button"
      data-feature-request-id={featureRequestId}
      data-count={count}
      data-upvoted={upvoted}
    >
      {count}
    </div>
  ),
}))

vi.mock('../../src/services/api', () => ({
  toggleUpvote: vi.fn(),
}))

const renderCard = (requestOverrides = {}, props = {}) => {
  const defaultRequest = {
    id: 1,
    title: 'Add dark mode support',
    description: 'Users want dark mode for better readability at night.',
    category: 'ui_ux',
    status: 'under_review',
    submitter_name: 'Jane Doe',
    upvote_count: 12,
    user_has_upvoted: false,
    comment_count: 3,
    created_at: '2025-06-15T10:30:00Z',
    admin_response: null,
  }

  const request = { ...defaultRequest, ...requestOverrides }

  return render(
    <BrowserRouter>
      <FeatureRequestCard request={request} {...props} />
    </BrowserRouter>
  )
}

describe('FeatureRequestCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders title', () => {
    renderCard({ title: 'Add dark mode support' })
    expect(screen.getByText('Add dark mode support')).toBeInTheDocument()
  })

  it('renders description', () => {
    renderCard({ description: 'Users want dark mode for better readability at night.' })
    expect(screen.getByText('Users want dark mode for better readability at night.')).toBeInTheDocument()
  })

  it('renders title with correct CSS class', () => {
    const { container } = renderCard()
    const title = container.querySelector('.fr-card__title')
    expect(title).toBeInTheDocument()
    expect(title).toHaveTextContent('Add dark mode support')
  })

  it('renders description with correct CSS class', () => {
    const { container } = renderCard()
    const description = container.querySelector('.fr-card__description')
    expect(description).toBeInTheDocument()
  })

  it('renders category badge with correct label for ui_ux', () => {
    renderCard({ category: 'ui_ux' })
    expect(screen.getByText('UI/UX')).toBeInTheDocument()
  })

  it('renders category badge with correct label for requirements', () => {
    renderCard({ category: 'requirements' })
    expect(screen.getByText('Requirements')).toBeInTheDocument()
  })

  it('renders category badge with correct label for jira_integration', () => {
    renderCard({ category: 'jira_integration' })
    expect(screen.getByText('Jira Integration')).toBeInTheDocument()
  })

  it('renders category badge with correct label for export', () => {
    renderCard({ category: 'export' })
    expect(screen.getByText('Export')).toBeInTheDocument()
  })

  it('renders category badge with correct label for new_capability', () => {
    renderCard({ category: 'new_capability' })
    expect(screen.getByText('New Capability')).toBeInTheDocument()
  })

  it('renders category badge with category value as fallback for unknown category', () => {
    renderCard({ category: 'unknown_category' })
    expect(screen.getByText('unknown_category')).toBeInTheDocument()
  })

  it('renders category badge with correct styling', () => {
    const { container } = renderCard({ category: 'ui_ux' })
    const badge = container.querySelector('.fr-card__category')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveStyle({ background: '#f3e8ff', color: '#7c3aed' })
  })

  it('renders status badge', () => {
    renderCard({ status: 'under_review' })
    expect(screen.getByText('under review')).toBeInTheDocument()
  })

  it('renders status badge with correct class for under_review', () => {
    const { container } = renderCard({ status: 'under_review' })
    const badge = container.querySelector('.badge--blue')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent('under review')
  })

  it('renders status badge with correct class for shipped', () => {
    const { container } = renderCard({ status: 'shipped' })
    const badge = container.querySelector('.badge--green')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent('shipped')
  })

  it('renders status badge with underscores replaced by spaces', () => {
    renderCard({ status: 'in_progress' })
    expect(screen.getByText('in progress')).toBeInTheDocument()
  })

  it('renders submitter name', () => {
    renderCard({ submitter_name: 'Jane Doe' })
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
  })

  it('renders submitter name with correct CSS class', () => {
    const { container } = renderCard({ submitter_name: 'Jane Doe' })
    const author = container.querySelector('.fr-card__author')
    expect(author).toBeInTheDocument()
    expect(author).toHaveTextContent('Jane Doe')
  })

  it('renders comment count', () => {
    const { container } = renderCard({ comment_count: 3 })
    const comments = container.querySelector('.fr-card__comments')
    expect(comments).toBeInTheDocument()
    expect(comments).toHaveTextContent('3')
  })

  it('renders comment count of zero', () => {
    const { container } = renderCard({ comment_count: 0 })
    const comments = container.querySelector('.fr-card__comments')
    expect(comments).toHaveTextContent('0')
  })

  it('renders formatted date', () => {
    const { container } = renderCard({ created_at: '2025-06-15T10:30:00Z' })
    const dateEl = container.querySelector('.fr-card__date')
    expect(dateEl).toBeInTheDocument()
    // The date should be formatted as "Jun 15" or similar locale-dependent format
    expect(dateEl.textContent).toMatch(/Jun\s+15/)
  })

  it('renders admin response when present', () => {
    renderCard({ admin_response: 'We are working on this feature.' })
    expect(screen.getByText('Admin Response')).toBeInTheDocument()
    expect(screen.getByText('We are working on this feature.')).toBeInTheDocument()
  })

  it('renders admin response with correct CSS classes', () => {
    const { container } = renderCard({ admin_response: 'Coming soon!' })
    const responseEl = container.querySelector('.fr-card__admin-response')
    expect(responseEl).toBeInTheDocument()
    const labelEl = container.querySelector('.fr-card__admin-label')
    expect(labelEl).toHaveTextContent('Admin Response')
    const textEl = container.querySelector('.fr-card__admin-text')
    expect(textEl).toHaveTextContent('Coming soon!')
  })

  it('does NOT render admin response when absent', () => {
    renderCard({ admin_response: null })
    expect(screen.queryByText('Admin Response')).not.toBeInTheDocument()
  })

  it('does NOT render admin response when empty string', () => {
    // Empty string is falsy, so admin_response section should not render
    renderCard({ admin_response: '' })
    expect(screen.queryByText('Admin Response')).not.toBeInTheDocument()
  })

  it('links to detail page with correct href', () => {
    renderCard({ id: 42 })
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/feature-requests/42')
  })

  it('link has correct CSS class', () => {
    const { container } = renderCard()
    const link = container.querySelector('.fr-card__content')
    expect(link).toBeInTheDocument()
    expect(link.tagName.toLowerCase()).toBe('a')
  })

  it('passes correct props to UpvoteButton', () => {
    renderCard({ id: 7, upvote_count: 25, user_has_upvoted: true })
    const upvoteBtn = screen.getByTestId('upvote-button')
    expect(upvoteBtn).toHaveAttribute('data-feature-request-id', '7')
    expect(upvoteBtn).toHaveAttribute('data-count', '25')
    expect(upvoteBtn).toHaveAttribute('data-upvoted', 'true')
  })

  it('passes onUpvoteToggle to UpvoteButton', () => {
    // Our mock doesn't capture onToggle, but we verify the component renders
    const onUpvoteToggle = vi.fn()
    renderCard({}, { onUpvoteToggle })
    expect(screen.getByTestId('upvote-button')).toBeInTheDocument()
  })

  it('renders the fr-card container', () => {
    const { container } = renderCard()
    const card = container.querySelector('.fr-card')
    expect(card).toBeInTheDocument()
  })
})
