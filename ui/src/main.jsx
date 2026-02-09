import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

// Import all page components
import DashboardPage from './pages/DashboardPage'
import ProjectViewPage from './pages/ProjectViewPage'
import ProjectsPage from './pages/ProjectsPage'
import ProjectDashboard from './pages/ProjectDashboard'
import UploadMeetingPage from './pages/UploadMeetingPage'
import RecapEditorPage from './pages/RecapEditorPage'
import ConflictResolverPage from './pages/ConflictResolverPage'
import RequirementsPage from './pages/RequirementsPage'
import SelectProjectPage from './pages/SelectProjectPage'
import NotFoundPage from './pages/NotFoundPage'
import JiraEpicPage from './pages/jira_epic/JiraEpicPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import PendingApprovalPage from './pages/PendingApprovalPage'
import AdminLayout from './pages/admin/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminUserManagement from './pages/admin/AdminUserManagement'
import AccessDeniedPage from './pages/admin/AccessDeniedPage'
import { AuthProvider } from './contexts/AuthContext'

// Create data router with all routes
const router = createBrowserRouter([
  { path: '/login', element: <AuthProvider><LoginPage /></AuthProvider> },
  { path: '/register', element: <AuthProvider><RegisterPage /></AuthProvider> },
  { path: '/pending-approval', element: <AuthProvider><PendingApprovalPage /></AuthProvider> },
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'dashboard', element: <DashboardPage /> },
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
      { path: 'app/jira-epic', element: <JiraEpicPage /> },
      { path: 'app/*', element: <ProjectsPage /> },
      // Admin routes
      { path: 'admin/access-denied', element: <AccessDeniedPage /> },
      {
        path: 'admin',
        element: <AdminLayout />,
        children: [
          { index: true, element: <AdminDashboard /> },
          { path: 'users', element: <AdminUserManagement /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
