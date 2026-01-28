import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PRDGeneratorPage from '../../src/pages/PRDGeneratorPage'

// Mock the api module
vi.mock('../../src/services/api', () => ({
  get: vi.fn(),
  generatePRD: vi.fn(),
  getPRDStatus: vi.fn(),
  cancelPRDGeneration: vi.fn()
}))

import { get, generatePRD, getPRDStatus, cancelPRDGeneration } from '../../src/services/api'

// Mock navigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate
  }
})

describe('PRDGeneratorPage', () => {
  const projectId = '123e4567-e89b-12d3-a456-426614174000'
  const prdId = 'prd-456'

  const mockProject = {
    id: projectId,
    name: 'Test Project',
    description: 'A test project description'
  }

  const renderWithRouter = (ui, { route = `/app/projects/${projectId}/prd` } = {}) => {
    return render(
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/app/projects/:projectId/prd" element={ui} />
          <Route path="/app/prd" element={<div>PRD Landing</div>} />
          <Route path="/app/prds/:prdId" element={<div>PRD Editor</div>} />
        </Routes>
      </MemoryRouter>
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockClear()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Initial Loading', () => {
    it('shows loading spinner while fetching project', async () => {
      get.mockImplementation(() => new Promise(() => {})) // Never resolves

      renderWithRouter(<PRDGeneratorPage />)

      expect(screen.getByText('Loading project...')).toBeInTheDocument()
    })

    it('displays project info after loading', async () => {
      get.mockResolvedValue(mockProject)

      renderWithRouter(<PRDGeneratorPage />)

      await waitFor(() => {
        expect(screen.getByText('Test Project')).toBeInTheDocument()
      })

      expect(screen.getByText('A test project description')).toBeInTheDocument()
    })

    it('displays error when project fetch fails', async () => {
      get.mockRejectedValue(new Error('Network error'))

      renderWithRouter(<PRDGeneratorPage />)

      await waitFor(() => {
        expect(screen.getByText('Error loading project: Network error')).toBeInTheDocument()
      })
    })

    it('shows retry button when project fetch fails', async () => {
      get.mockRejectedValue(new Error('Network error'))

      renderWithRouter(<PRDGeneratorPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
      })
    })

    it('retries fetching project when retry button is clicked', async () => {
      get.mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue(mockProject)

      renderWithRouter(<PRDGeneratorPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

      await waitFor(() => {
        expect(screen.getByText('Test Project')).toBeInTheDocument()
      })
    })
  })

  describe('Mode Selection', () => {
    beforeEach(() => {
      get.mockResolvedValue(mockProject)
    })

    it('displays both Draft and Detailed mode options', async () => {
      renderWithRouter(<PRDGeneratorPage />)

      await waitFor(() => {
        expect(screen.getByText('Draft Mode')).toBeInTheDocument()
      })

      expect(screen.getByText('Detailed Mode')).toBeInTheDocument()
    })

    it('has Draft mode selected by default', async () => {
      renderWithRouter(<PRDGeneratorPage />)

      await waitFor(() => {
        expect(screen.getByText('Draft Mode')).toBeInTheDocument()
      })

      // Find the Draft Mode button and check if it has the selected class
      const draftButton = screen.getByText('Draft Mode').closest('button')
      expect(draftButton).toHaveClass('prd-mode-option--selected')
    })

    it('updates selection when clicking Detailed mode', async () => {
      renderWithRouter(<PRDGeneratorPage />)

      await waitFor(() => {
        expect(screen.getByText('Detailed Mode')).toBeInTheDocument()
      })

      // Find and click Detailed Mode button
      const detailedButton = screen.getByText('Detailed Mode').closest('button')
      fireEvent.click(detailedButton)

      // Verify Detailed is now selected
      expect(detailedButton).toHaveClass('prd-mode-option--selected')

      // Verify Draft is no longer selected
      const draftButton = screen.getByText('Draft Mode').closest('button')
      expect(draftButton).not.toHaveClass('prd-mode-option--selected')
    })

    it('allows switching back to Draft mode', async () => {
      renderWithRouter(<PRDGeneratorPage />)

      await waitFor(() => {
        expect(screen.getByText('Detailed Mode')).toBeInTheDocument()
      })

      // Click Detailed, then Draft
      const detailedButton = screen.getByText('Detailed Mode').closest('button')
      const draftButton = screen.getByText('Draft Mode').closest('button')

      fireEvent.click(detailedButton)
      fireEvent.click(draftButton)

      expect(draftButton).toHaveClass('prd-mode-option--selected')
      expect(detailedButton).not.toHaveClass('prd-mode-option--selected')
    })

    it('disables mode selection while generating', async () => {
      get.mockResolvedValue(mockProject)
      generatePRD.mockImplementation(() => new Promise(() => {})) // Never resolves

      renderWithRouter(<PRDGeneratorPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Generate PRD/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /Generate PRD/i }))

      await waitFor(() => {
        const draftButton = screen.getByText('Draft Mode').closest('button')
        expect(draftButton).toBeDisabled()
      })
    })
  })

  describe('Generate Button', () => {
    beforeEach(() => {
      get.mockResolvedValue(mockProject)
    })

    it('displays Generate PRD button', async () => {
      renderWithRouter(<PRDGeneratorPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Generate PRD/i })).toBeInTheDocument()
      })
    })

    it('button is enabled when project is loaded', async () => {
      renderWithRouter(<PRDGeneratorPage />)

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /Generate PRD/i })
        expect(button).not.toBeDisabled()
      })
    })

    it('triggers API call when clicked', async () => {
      generatePRD.mockResolvedValue({ id: prdId, status: 'queued' })
      getPRDStatus.mockResolvedValue({ status: 'queued' })

      renderWithRouter(<PRDGeneratorPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Generate PRD/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /Generate PRD/i }))

      await waitFor(() => {
        expect(generatePRD).toHaveBeenCalledWith(projectId, { mode: 'draft' })
      })
    })

    it('sends correct mode when Detailed is selected', async () => {
      generatePRD.mockResolvedValue({ id: prdId, status: 'queued' })
      getPRDStatus.mockResolvedValue({ status: 'queued' })

      renderWithRouter(<PRDGeneratorPage />)

      await waitFor(() => {
        expect(screen.getByText('Detailed Mode')).toBeInTheDocument()
      })

      // Select Detailed mode
      fireEvent.click(screen.getByText('Detailed Mode').closest('button'))

      // Click Generate
      fireEvent.click(screen.getByRole('button', { name: /Generate PRD/i }))

      await waitFor(() => {
        expect(generatePRD).toHaveBeenCalledWith(projectId, { mode: 'detailed' })
      })
    })

    it('shows progress overlay when generating', async () => {
      generatePRD.mockResolvedValue({ id: prdId, status: 'queued' })
      getPRDStatus.mockResolvedValue({ status: 'generating' })

      renderWithRouter(<PRDGeneratorPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Generate PRD/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /Generate PRD/i }))

      await waitFor(() => {
        expect(screen.getByText('Queued for Generation...')).toBeInTheDocument()
      })
    })

    it('shows error message when generation fails to start', async () => {
      generatePRD.mockRejectedValue(new Error('Failed to start generation'))

      renderWithRouter(<PRDGeneratorPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Generate PRD/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /Generate PRD/i }))

      await waitFor(() => {
        expect(screen.getByText('Failed to start generation')).toBeInTheDocument()
      })
    })
  })

  describe('Cooldown Timer', () => {
    beforeEach(() => {
      get.mockResolvedValue(mockProject)
    })

    it('shows cooldown timer after starting generation', async () => {
      generatePRD.mockResolvedValue({ id: prdId, status: 'queued' })
      getPRDStatus.mockResolvedValue({ status: 'queued' })

      renderWithRouter(<PRDGeneratorPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Generate PRD/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /Generate PRD/i }))

      await waitFor(() => {
        expect(screen.getByText(/Cooldown \(30s\)/)).toBeInTheDocument()
      })
    })

    it('disables button during cooldown', async () => {
      generatePRD.mockResolvedValue({ id: prdId, status: 'queued' })
      getPRDStatus.mockResolvedValue({ status: 'cancelled' }) // Immediately complete

      renderWithRouter(<PRDGeneratorPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Generate PRD/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /Generate PRD/i }))

      // Wait for generation to be cancelled (status check)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2500) // Wait for first poll
      })

      // Now the button should show cooldown and be disabled
      await waitFor(() => {
        const button = screen.getByRole('button', { name: /Cooldown/i })
        expect(button).toBeDisabled()
      })
    })

    it('countdown decreases over time', async () => {
      generatePRD.mockResolvedValue({ id: prdId, status: 'queued' })
      getPRDStatus.mockResolvedValue({ status: 'cancelled' })

      renderWithRouter(<PRDGeneratorPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Generate PRD/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /Generate PRD/i }))

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2500)
      })

      // Wait for cooldown to start - use a flexible regex to match any countdown value
      await waitFor(() => {
        expect(screen.getByText(/Cooldown \(\d+s\)/)).toBeInTheDocument()
      })

      // Get the initial countdown value
      const initialButton = screen.getByText(/Cooldown \(\d+s\)/)
      const initialMatch = initialButton.textContent.match(/Cooldown \((\d+)s\)/)
      const initialValue = parseInt(initialMatch[1], 10)

      // Advance timer by 5 seconds
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000)
      })

      // Verify countdown decreased (allow for timing variance)
      await waitFor(() => {
        const button = screen.getByText(/Cooldown \(\d+s\)/)
        const match = button.textContent.match(/Cooldown \((\d+)s\)/)
        const currentValue = parseInt(match[1], 10)
        expect(currentValue).toBeLessThan(initialValue)
      })
    })

    it('shows hint message during cooldown', async () => {
      generatePRD.mockResolvedValue({ id: prdId, status: 'queued' })
      getPRDStatus.mockResolvedValue({ status: 'cancelled' })

      renderWithRouter(<PRDGeneratorPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Generate PRD/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /Generate PRD/i }))

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2500)
      })

      await waitFor(() => {
        expect(screen.getByText('Please wait before generating again')).toBeInTheDocument()
      })
    })

    it('re-enables button after cooldown expires', async () => {
      generatePRD.mockResolvedValue({ id: prdId, status: 'queued' })
      getPRDStatus.mockResolvedValue({ status: 'cancelled' })

      renderWithRouter(<PRDGeneratorPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Generate PRD/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /Generate PRD/i }))

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2500)
      })

      await waitFor(() => {
        expect(screen.getByText(/Cooldown/)).toBeInTheDocument()
      })

      // Advance timer past cooldown (30 seconds total)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(31000)
      })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Generate PRD/i })).not.toBeDisabled()
      })
    })
  })

  describe('Status Polling', () => {
    beforeEach(() => {
      get.mockResolvedValue(mockProject)
    })

    it('polls for status after starting generation', async () => {
      generatePRD.mockResolvedValue({ id: prdId, status: 'queued' })
      getPRDStatus.mockResolvedValue({ status: 'generating' })

      renderWithRouter(<PRDGeneratorPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Generate PRD/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /Generate PRD/i }))

      // Wait for first poll
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100)
      })

      expect(getPRDStatus).toHaveBeenCalledWith(prdId)

      // Wait for second poll
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000)
      })

      expect(getPRDStatus).toHaveBeenCalledTimes(2)
    })

    it('navigates to editor when status is ready', async () => {
      generatePRD.mockResolvedValue({ id: prdId, status: 'queued' })
      getPRDStatus.mockResolvedValueOnce({ status: 'generating' })
        .mockResolvedValueOnce({ status: 'ready' })

      renderWithRouter(<PRDGeneratorPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Generate PRD/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /Generate PRD/i }))

      // First poll - generating
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100)
      })

      // Second poll - ready
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2100)
      })

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(`/app/prds/${prdId}`)
      })
    })

    it('shows error when status is failed', async () => {
      generatePRD.mockResolvedValue({ id: prdId, status: 'queued' })
      getPRDStatus.mockResolvedValue({
        status: 'failed',
        error_message: 'LLM timeout occurred'
      })

      renderWithRouter(<PRDGeneratorPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Generate PRD/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /Generate PRD/i }))

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100)
      })

      await waitFor(() => {
        expect(screen.getByText('LLM timeout occurred')).toBeInTheDocument()
      })
    })

    it('clears loading state when status is cancelled', async () => {
      generatePRD.mockResolvedValue({ id: prdId, status: 'queued' })
      getPRDStatus.mockResolvedValue({ status: 'cancelled' })

      renderWithRouter(<PRDGeneratorPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Generate PRD/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /Generate PRD/i }))

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100)
      })

      await waitFor(() => {
        // Progress overlay should be gone
        expect(screen.queryByText('Queued for Generation...')).not.toBeInTheDocument()
        expect(screen.queryByText('Generating PRD...')).not.toBeInTheDocument()
      })
    })
  })

  describe('Cancel Generation', () => {
    beforeEach(() => {
      get.mockResolvedValue(mockProject)
    })

    it('shows cancel button during generation', async () => {
      generatePRD.mockResolvedValue({ id: prdId, status: 'queued' })
      getPRDStatus.mockResolvedValue({ status: 'generating' })

      renderWithRouter(<PRDGeneratorPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Generate PRD/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /Generate PRD/i }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Cancel Generation' })).toBeInTheDocument()
      })
    })

    it('calls cancel API when cancel button is clicked', async () => {
      generatePRD.mockResolvedValue({ id: prdId, status: 'queued' })
      getPRDStatus.mockResolvedValue({ status: 'generating' })
      cancelPRDGeneration.mockResolvedValue({})

      renderWithRouter(<PRDGeneratorPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Generate PRD/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /Generate PRD/i }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Cancel Generation' })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: 'Cancel Generation' }))

      expect(cancelPRDGeneration).toHaveBeenCalledWith(prdId)
    })

    it('shows error if cancel fails', async () => {
      generatePRD.mockResolvedValue({ id: prdId, status: 'queued' })
      getPRDStatus.mockResolvedValue({ status: 'generating' })
      cancelPRDGeneration.mockRejectedValue(new Error('Cancel failed'))

      renderWithRouter(<PRDGeneratorPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Generate PRD/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /Generate PRD/i }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Cancel Generation' })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: 'Cancel Generation' }))

      await waitFor(() => {
        expect(screen.getByText('Cancel failed')).toBeInTheDocument()
      })
    })
  })

  describe('Error Recovery', () => {
    beforeEach(() => {
      get.mockResolvedValue(mockProject)
    })

    it('shows Try Again button on error', async () => {
      generatePRD.mockRejectedValue(new Error('Generation failed'))

      renderWithRouter(<PRDGeneratorPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Generate PRD/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /Generate PRD/i }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument()
      })
    })

    it('clears error and allows retry when Try Again is clicked', async () => {
      generatePRD
        .mockRejectedValueOnce(new Error('Generation failed'))
        .mockResolvedValue({ id: prdId, status: 'queued' })
      getPRDStatus.mockResolvedValue({ status: 'queued' })

      renderWithRouter(<PRDGeneratorPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Generate PRD/i })).toBeInTheDocument()
      })

      // First attempt fails
      fireEvent.click(screen.getByRole('button', { name: /Generate PRD/i }))

      await waitFor(() => {
        expect(screen.getByText('Generation failed')).toBeInTheDocument()
      })

      // Click Try Again
      fireEvent.click(screen.getByRole('button', { name: 'Try Again' }))

      // Error should be cleared
      expect(screen.queryByText('Generation failed')).not.toBeInTheDocument()

      // Generate button should be available again
      expect(screen.getByRole('button', { name: /Generate PRD/i })).toBeInTheDocument()
    })
  })

  describe('Navigation', () => {
    beforeEach(() => {
      get.mockResolvedValue(mockProject)
    })

    it('displays back to PRD link', async () => {
      renderWithRouter(<PRDGeneratorPage />)

      await waitFor(() => {
        expect(screen.getByText('Back to PRD')).toBeInTheDocument()
      })

      expect(screen.getByText('Back to PRD')).toHaveAttribute('href', '/app/prd')
    })
  })
})
