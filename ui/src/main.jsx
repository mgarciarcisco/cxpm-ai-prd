import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

// Import all page components
import DashboardPage from './pages/DashboardPage'
import QuickConvertPage from './pages/QuickConvertPage'
import QuickConvertRequirementsPage from './pages/QuickConvertRequirementsPage'
import QuickConvertPRDPage from './pages/QuickConvertPRDPage'
import QuickConvertStoriesPage from './pages/QuickConvertStoriesPage'
import QuickConvertMockupsPage from './pages/QuickConvertMockupsPage'
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
import NotFoundPage from './pages/NotFoundPage'

// Create data router with all routes
const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'quick-convert', element: <QuickConvertPage /> },
      { path: 'quick-convert/requirements', element: <QuickConvertRequirementsPage /> },
      { path: 'quick-convert/prd', element: <QuickConvertPRDPage /> },
      { path: 'quick-convert/stories', element: <QuickConvertStoriesPage /> },
      { path: 'quick-convert/mockups', element: <QuickConvertMockupsPage /> },
      { path: 'projects/:id', element: <ProjectViewPage /> },
      { path: 'projects/:id/:stage', element: <ProjectViewPage /> },
      { path: 'app', element: <ProjectsPage /> },
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
