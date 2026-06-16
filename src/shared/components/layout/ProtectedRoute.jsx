import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/shared/context/AuthContext'
import { Skeleton } from '@/shared/components/ui/Skeleton'

export function ProtectedRoute({ role }) {
  const { user, profile, loading, profileLoaded } = useAuth()

  // Show skeleton while auth is initialising OR while we're waiting for the
  // profile fetch to complete. Without the second check, ProtectedRoute would
  // evaluate `profile?.role` as undefined and redirect before the profile
  // arrives — causing the dashboard to never mount (blank screen).
  if (loading || (user && !profileLoaded)) {
    return (
      <div className="min-h-screen flex flex-col gap-4 items-center justify-center bg-[#F8FAFC]">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-4 w-56" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Only redirect on role mismatch when we actually know the user's role.
  // If the profile row is missing (trigger didn't fire, RLS issue, etc.) we
  // fall through and render the Outlet rather than looping forever.
  if (role && profile?.role && profile.role !== role) {
    const redirect = profile.role === 'admin' ? '/admin/dashboard' : '/dashboard'
    return <Navigate to={redirect} replace />
  }

  return <Outlet />
}
