import { createBrowserRouter, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '@/shared/components/layout/ProtectedRoute'
import { StudentLayout } from '@/shared/components/layout/StudentLayout'
import { AdminLayout } from '@/shared/components/layout/AdminLayout'

import Login from '@/features/auth/pages/Login'
import Register from '@/features/auth/pages/Register'

import StudentDashboard from '@/features/student/pages/StudentDashboard'
import ComponentsPage from '@/features/components/pages/ComponentsPage'
import ComponentDetailPage from '@/features/components/pages/ComponentDetailPage'
import MyRequestsPage from '@/features/borrows/pages/MyRequestsPage'
import CartPage from '@/features/borrows/pages/CartPage'
import RequestItemPage from '@/features/item-requests/pages/RequestItemPage'
import NotificationsPage from '@/features/notifications/pages/NotificationsPage'
import ProfilePage from '@/features/student/pages/ProfilePage'

import AdminDashboard from '@/features/admin/pages/AdminDashboard'
import ManageComponents from '@/features/admin/pages/ManageComponents'
import ManageLockers from '@/features/admin/pages/ManageLockers'
import ManageRequests from '@/features/admin/pages/ManageRequests'
import ManageOverdues from '@/features/admin/pages/ManageOverdues'
import ManageNewItemRequests from '@/features/admin/pages/ManageNewItemRequests'
import ManageStudents from '@/features/admin/pages/ManageStudents'
import AdminProfilePage from '@/features/admin/pages/AdminProfilePage'

export const router = createBrowserRouter([
  { index: true, element: <Navigate to="/login" replace /> },
  { path: '/login', element: <Login /> },
  { path: '/register', element: <Register /> },

  {
    element: <ProtectedRoute role="student" />,
    children: [
      {
        element: <StudentLayout />,
        children: [
          { path: '/dashboard', element: <StudentDashboard /> },
          { path: '/components', element: <ComponentsPage /> },
          { path: '/components/:id', element: <ComponentDetailPage /> },
          { path: '/my-requests', element: <MyRequestsPage /> },
          { path: '/cart', element: <CartPage /> },
          { path: '/request-item', element: <RequestItemPage /> },
          { path: '/notifications', element: <NotificationsPage /> },
          { path: '/profile', element: <ProfilePage /> },
        ],
      },
    ],
  },

  {
    element: <ProtectedRoute role="admin" />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { path: '/admin/dashboard', element: <AdminDashboard /> },
          { path: '/admin/components', element: <ManageComponents /> },
          { path: '/admin/lockers', element: <ManageLockers /> },
          { path: '/admin/requests', element: <ManageRequests /> },
          { path: '/admin/overdues', element: <ManageOverdues /> },
          { path: '/admin/new-item-requests', element: <ManageNewItemRequests /> },
          { path: '/admin/students', element: <ManageStudents /> },
          { path: '/admin/profile', element: <AdminProfilePage /> },
        ],
      },
    ],
  },

  { path: '*', element: <Navigate to="/login" replace /> },
])
