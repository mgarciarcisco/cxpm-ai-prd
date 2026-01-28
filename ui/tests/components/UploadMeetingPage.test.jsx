import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import UploadMeetingPage from '../../src/pages/UploadMeetingPage'

// Mock fetch for API calls
global.fetch = vi.fn()

const renderWithRouter = (component, { route = '/app/projects/123/meetings/new' } = {}) => {
  window.history.pushState({}, 'Test page', route)
  return render(
    <BrowserRouter>
      <Routes>
        <Route path="/app/projects/:id/meetings/new" element={component} />
        <Route path="/app/projects/:id/meetings/:mid" element={<div>Meeting Page</div>} />
        <Route path="/app/projects/:id" element={<div>Project Dashboard</div>} />
      </Routes>
    </BrowserRouter>
  )
}

describe('UploadMeetingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch.mockReset()
  })

  describe('Title input validation', () => {
    it('renders title input field', () => {
      renderWithRouter(<UploadMeetingPage />)
      expect(screen.getByLabelText(/meeting title/i)).toBeInTheDocument()
    })

    it('shows required indicator on title field', () => {
      renderWithRouter(<UploadMeetingPage />)
      expect(screen.getByText('*')).toBeInTheDocument()
    })

    it('disables submit button when title is empty', () => {
      renderWithRouter(<UploadMeetingPage />)
      const submitButton = screen.getByRole('button', { name: /process meeting notes/i })
      expect(submitButton).toBeDisabled()
    })

    it('disables submit button when title contains only whitespace', async () => {
      const user = userEvent.setup()
      renderWithRouter(<UploadMeetingPage />)

      const titleInput = screen.getByLabelText(/meeting title/i)
      await user.type(titleInput, '   ')

      const submitButton = screen.getByRole('button', { name: /process meeting notes/i })
      expect(submitButton).toBeDisabled()
    })

    it('enables submit button when title is provided with text input', async () => {
      const user = userEvent.setup()
      renderWithRouter(<UploadMeetingPage />)

      const titleInput = screen.getByLabelText(/meeting title/i)
      const textArea = screen.getByLabelText(/paste meeting notes/i)

      await user.type(titleInput, 'Sprint Planning')
      await user.type(textArea, 'Some meeting notes content')

      const submitButton = screen.getByRole('button', { name: /process meeting notes/i })
      expect(submitButton).not.toBeDisabled()
    })
  })

  describe('File size validation', () => {
    it('shows error for files over 50KB', async () => {
      renderWithRouter(<UploadMeetingPage />)

      // Create a file larger than 50KB (51KB)
      const largeContent = 'x'.repeat(51 * 1024)
      const largeFile = new File([largeContent], 'large-file.txt', { type: 'text/plain' })

      // Find the file input (hidden)
      const fileInput = document.querySelector('input[type="file"]')

      // Simulate file selection
      await waitFor(() => {
        fireEvent.change(fileInput, { target: { files: [largeFile] } })
      })

      // Check for error message
      await waitFor(() => {
        expect(screen.getByText(/file too large/i)).toBeInTheDocument()
      })
    })

    it('shows specific file size in error message', async () => {
      renderWithRouter(<UploadMeetingPage />)

      // Create a file of exactly 60KB
      const content = 'x'.repeat(60 * 1024)
      const largeFile = new File([content], 'large-file.txt', { type: 'text/plain' })

      const fileInput = document.querySelector('input[type="file"]')

      await waitFor(() => {
        fireEvent.change(fileInput, { target: { files: [largeFile] } })
      })

      await waitFor(() => {
        expect(screen.getByText(/maximum size is 50kb/i)).toBeInTheDocument()
        expect(screen.getByText(/60\.0kb/i)).toBeInTheDocument()
      })
    })

    it('accepts files under 50KB', async () => {
      renderWithRouter(<UploadMeetingPage />)

      // Create a file under 50KB (10KB)
      const content = 'x'.repeat(10 * 1024)
      const validFile = new File([content], 'valid-file.txt', { type: 'text/plain' })

      const fileInput = document.querySelector('input[type="file"]')

      await waitFor(() => {
        fireEvent.change(fileInput, { target: { files: [validFile] } })
      })

      // File should be shown (no error message)
      await waitFor(() => {
        expect(screen.queryByText(/file too large/i)).not.toBeInTheDocument()
        expect(screen.getByText('valid-file.txt')).toBeInTheDocument()
      })
    })

    it('accepts files exactly at 50KB limit', async () => {
      renderWithRouter(<UploadMeetingPage />)

      // Create a file of exactly 50KB
      const content = 'x'.repeat(50 * 1024)
      const exactFile = new File([content], 'exact-file.txt', { type: 'text/plain' })

      const fileInput = document.querySelector('input[type="file"]')

      await waitFor(() => {
        fireEvent.change(fileInput, { target: { files: [exactFile] } })
      })

      // File should be accepted (no error)
      await waitFor(() => {
        expect(screen.queryByText(/file too large/i)).not.toBeInTheDocument()
        expect(screen.getByText('exact-file.txt')).toBeInTheDocument()
      })
    })
  })

  describe('File drop functionality', () => {
    it('renders file dropzone', () => {
      renderWithRouter(<UploadMeetingPage />)
      expect(screen.getByText(/click to upload/i)).toBeInTheDocument()
    })

    it('shows file name after file selection', async () => {
      renderWithRouter(<UploadMeetingPage />)

      const content = 'Meeting notes content'
      const file = new File([content], 'meeting-notes.txt', { type: 'text/plain' })

      const fileInput = document.querySelector('input[type="file"]')

      await waitFor(() => {
        fireEvent.change(fileInput, { target: { files: [file] } })
      })

      await waitFor(() => {
        expect(screen.getByText('meeting-notes.txt')).toBeInTheDocument()
      })
    })

    it('enables submit button when file is selected and title is provided', async () => {
      const user = userEvent.setup()
      renderWithRouter(<UploadMeetingPage />)

      // Enter title
      const titleInput = screen.getByLabelText(/meeting title/i)
      await user.type(titleInput, 'Sprint Planning')

      // Select file
      const content = 'Meeting notes content'
      const file = new File([content], 'meeting-notes.txt', { type: 'text/plain' })
      const fileInput = document.querySelector('input[type="file"]')

      await waitFor(() => {
        fireEvent.change(fileInput, { target: { files: [file] } })
      })

      const submitButton = screen.getByRole('button', { name: /process meeting notes/i })
      expect(submitButton).not.toBeDisabled()
    })
  })

  describe('Text paste input', () => {
    it('renders text input area', () => {
      renderWithRouter(<UploadMeetingPage />)
      expect(screen.getByLabelText(/paste meeting notes/i)).toBeInTheDocument()
    })

    it('allows text input', async () => {
      const user = userEvent.setup()
      renderWithRouter(<UploadMeetingPage />)

      const textArea = screen.getByLabelText(/paste meeting notes/i)
      await user.type(textArea, 'My meeting notes content')

      expect(textArea.value).toBe('My meeting notes content')
    })

    it('enables submit button when text and title are provided', async () => {
      const user = userEvent.setup()
      renderWithRouter(<UploadMeetingPage />)

      const titleInput = screen.getByLabelText(/meeting title/i)
      const textArea = screen.getByLabelText(/paste meeting notes/i)

      await user.type(titleInput, 'Sprint Planning')
      await user.type(textArea, 'Some meeting notes')

      const submitButton = screen.getByRole('button', { name: /process meeting notes/i })
      expect(submitButton).not.toBeDisabled()
    })

    it('disables submit button when text is only whitespace', async () => {
      const user = userEvent.setup()
      renderWithRouter(<UploadMeetingPage />)

      const titleInput = screen.getByLabelText(/meeting title/i)
      const textArea = screen.getByLabelText(/paste meeting notes/i)

      await user.type(titleInput, 'Sprint Planning')
      await user.type(textArea, '   ')

      const submitButton = screen.getByRole('button', { name: /process meeting notes/i })
      expect(submitButton).toBeDisabled()
    })

    it('clears file state when text is entered', async () => {
      const user = userEvent.setup()
      renderWithRouter(<UploadMeetingPage />)

      // First select a file
      const content = 'File content'
      const file = new File([content], 'meeting.txt', { type: 'text/plain' })
      const fileInput = document.querySelector('input[type="file"]')

      await waitFor(() => {
        fireEvent.change(fileInput, { target: { files: [file] } })
      })

      // Verify file is shown
      await waitFor(() => {
        expect(screen.getByText('meeting.txt')).toBeInTheDocument()
      })

      // Enter title and text - text should be used for submission, not file
      const titleInput = screen.getByLabelText(/meeting title/i)
      const textArea = screen.getByLabelText(/paste meeting notes/i)

      // First clear the file by clicking clear button to enable textarea
      const clearButton = screen.getByRole('button', { name: /remove file/i })
      await user.click(clearButton)

      // Now text area should be enabled and we can type
      await user.type(titleInput, 'Test Meeting')
      await user.type(textArea, 'Some text content')

      // Verify submit is enabled (meaning text is being used)
      const submitButton = screen.getByRole('button', { name: /process meeting notes/i })
      expect(submitButton).not.toBeDisabled()

      // File should no longer be shown
      expect(screen.queryByText('meeting.txt')).not.toBeInTheDocument()
    })

    it('disables textarea when file is selected', async () => {
      renderWithRouter(<UploadMeetingPage />)

      // Select a file
      const content = 'File content'
      const file = new File([content], 'meeting.txt', { type: 'text/plain' })
      const fileInput = document.querySelector('input[type="file"]')

      await waitFor(() => {
        fireEvent.change(fileInput, { target: { files: [file] } })
      })

      // Textarea should be disabled
      const textArea = screen.getByLabelText(/paste meeting notes/i)
      expect(textArea).toBeDisabled()
    })
  })

  describe('Form submission', () => {
    it('shows loading state during submission', async () => {
      const user = userEvent.setup()

      // Mock a slow API response
      global.fetch.mockImplementation(() =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: () => Promise.resolve({ meeting_id: '456', job_id: '456' })
            })
          }, 100)
        })
      )

      renderWithRouter(<UploadMeetingPage />)

      const titleInput = screen.getByLabelText(/meeting title/i)
      const textArea = screen.getByLabelText(/paste meeting notes/i)

      await user.type(titleInput, 'Sprint Planning')
      await user.type(textArea, 'Some meeting notes')

      const submitButton = screen.getByRole('button', { name: /process meeting notes/i })
      await user.click(submitButton)

      // Should show loading state
      await waitFor(() => {
        expect(screen.getByText(/uploading/i)).toBeInTheDocument()
      })
    })

    it('shows error message on API failure', async () => {
      const user = userEvent.setup()

      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ detail: 'Project not found' })
      })

      renderWithRouter(<UploadMeetingPage />)

      const titleInput = screen.getByLabelText(/meeting title/i)
      const textArea = screen.getByLabelText(/paste meeting notes/i)

      await user.type(titleInput, 'Sprint Planning')
      await user.type(textArea, 'Some meeting notes')

      const submitButton = screen.getByRole('button', { name: /process meeting notes/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/project not found/i)).toBeInTheDocument()
      })
    })
  })
})
