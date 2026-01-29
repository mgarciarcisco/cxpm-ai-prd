import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PRDGeneratorPage from '../../src/pages/PRDGeneratorPage'

// Mock the api module
vi.mock('../../src/services/api', () => ({
  get: vi.fn()
}))

import { get } from '../../src/services/api'

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

  const mockProject = {
    id: projectId,
    name: 'Test Project',
    description: 'A test project description'
  }

  const renderWithRouter = (ui, { route = `/app/projects/${projectId}/prd/generate` } = {}) => {
    return render(
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/app/projects/:projectId/prd/generate" element={ui} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockClear()
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

    it('navigates to streaming page with draft mode when clicked', async () => {
      renderWithRouter(<PRDGeneratorPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Generate PRD/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /Generate PRD/i }))

      expect(mockNavigate).toHaveBeenCalledWith(
        `/app/projects/${projectId}/prd/streaming`,
        { state: { mode: 'draft' } }
      )
    })

    it('navigates with detailed mode when Detailed is selected', async () => {
      renderWithRouter(<PRDGeneratorPage />)

      await waitFor(() => {
        expect(screen.getByText('Detailed Mode')).toBeInTheDocument()
      })

      // Select Detailed mode
      fireEvent.click(screen.getByText('Detailed Mode').closest('button'))

      // Click Generate
      fireEvent.click(screen.getByRole('button', { name: /Generate PRD/i }))

      expect(mockNavigate).toHaveBeenCalledWith(
        `/app/projects/${projectId}/prd/streaming`,
        { state: { mode: 'detailed' } }
      )
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

      expect(screen.getByText('Back to PRD')).toHaveAttribute('href', '/dashboard')
    })
  })
})
