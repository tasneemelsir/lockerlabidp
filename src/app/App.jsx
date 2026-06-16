import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from '@/shared/context/AuthContext'
import { AppErrorBoundary } from '@/shared/components/ErrorBoundary'
import { router } from './Router'

export default function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <RouterProvider router={router} />
        <Toaster position="top-right" />
      </AuthProvider>
    </AppErrorBoundary>
  )
}
