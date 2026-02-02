import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

// Import all page components
import DashboardPage from './pages/DashboardPage'
// QuickConvertPage archived - task cards now on main dashboard
import QuickConvertRequirementsPage from './pages/QuickConvertRequirementsPage'
// QuickConvertPRDPage archived - coming soon
import QuickConvertStoriesPage from './pages/QuickConvertStoriesPage'
// QuickConvertMockupsPage archived - coming soon
import ProjectViewPage from './pages/ProjectViewPage'
import ProjectsPage from './pages/ProjectsPage'
import ProjectDashboard from './pages/ProjectDashboard'
import UploadMeetingPage from './pages/UploadMeetingPage'
import RecapEditorPage from './pages/RecapEditorPage'
import ConflictResolverPage from './pages/ConflictResolverPage'
import RequirementsPage from './pages/RequirementsPage'
import PRDGeneratorPage from './pages/PRDGeneratorPage'
import PRDStreamingPage from './pages/PRDStreamingPage'
import PRDEditorPage from './pages/PRDEditorPage'
import UserStoriesPage from './pages/UserStoriesPage'
import SelectProjectPage from './pages/SelectProjectPage'
import NotFoundPage from './pages/NotFoundPage'
import JiraEpicPage from './pages/jira_epic/JiraEpicPage'

// Create data router with all routes
const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'dashboard', element: <DashboardPage /> },
      // Quick Convert landing page archived - redirect to dashboard
      { path: 'quick-convert', element: <Navigate to="/dashboard" replace /> },
      { path: 'quick-convert/requirements', element: <QuickConvertRequirementsPage /> },
      // PRD quick convert archived - coming soon
      { path: 'quick-convert/prd', element: <Navigate to="/dashboard" replace /> },
      { path: 'quick-convert/stories', element: <QuickConvertStoriesPage /> },
      // Mockups quick convert archived - coming soon
      { path: 'quick-convert/mockups', element: <Navigate to="/dashboard" replace /> },
      { path: 'projects/:id', element: <ProjectViewPage /> },
      { path: 'projects/:id/:stage', element: <ProjectViewPage /> },
      { path: 'app', element: <ProjectsPage /> },
      // Unified meeting flow - no project context (from dashboard)
      { path: 'app/meetings/new', element: <UploadMeetingPage /> },
      { path: 'app/meetings/:mid', element: <RecapEditorPage /> },
      { path: 'app/meetings/:mid/select-project', element: <SelectProjectPage /> },
      { path: 'app/meetings/:mid/apply', element: <ConflictResolverPage /> },
      // Project-specific meeting flow
      { path: 'app/projects/:id', element: <ProjectDashboard /> },
      { path: 'app/projects/:id/meetings/new', element: <UploadMeetingPage /> },
      { path: 'app/projects/:id/meetings/:mid', element: <RecapEditorPage /> },
      { path: 'app/projects/:id/meetings/:mid/apply', element: <ConflictResolverPage /> },
      { path: 'app/projects/:id/requirements', element: <RequirementsPage /> },
      { path: 'app/prd', element: <DashboardPage /> },
      { path: 'app/projects/:projectId/prd/generate', element: <PRDGeneratorPage /> },
      { path: 'app/projects/:projectId/prd/streaming', element: <PRDStreamingPage /> },
      { path: 'app/prds/:prdId', element: <PRDEditorPage /> },
      { path: 'app/stories', element: <DashboardPage /> },
      { path: 'app/projects/:projectId/stories', element: <UserStoriesPage /> },
      { path: 'app/jira-epic', element: <JiraEpicPage /> },
      { path: 'app/*', element: <ProjectsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
