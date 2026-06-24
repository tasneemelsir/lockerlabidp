import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/shared/lib/supabase'

export function useStudentDashboard() {
  const [activeLoans,  setActiveLoans]  = useState([])
  const [overdueLoans, setOverdueLoans] = useState([])
  const [stats, setStats]   = useState({ totalBorrowed: 0, activeCount: 0, overdueCount: 0, returnedCount: 0 })
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: allRequests, error: queryError } = await supabase
        .from('borrow_requests')
        .select(`
          *,
          lockers:assigned_locker_id (
            id,
            locker_code,
            description
          ),
          borrow_request_items (
            id,
            quantity_requested,
            components (
              id,
              name,
              category
            )
          )
        `)
        .eq('student_id', user.id)

      if (queryError) {
        console.error('[useStudentDashboard] Query error:', queryError.message)
        setError(queryError.message)
      }

      const all = allRequests ?? []

      const activeOnly = all.filter(r => r.status === 'active')
      const overdue    = all.filter(r => r.status === 'overdue')
      const active     = [...activeOnly, ...all.filter(r => r.status === 'return_requested')]

      setActiveLoans(active)
      setOverdueLoans(overdue)
      setStats({
        totalBorrowed: all.filter(r => r.status !== 'pending').length,
        activeCount:   activeOnly.length,
        overdueCount:  overdue.length,
        returnedCount: all.filter(r => r.status === 'returned').length,
      })

      // Overdue detection and due-soon reminders are now handled server-side
      // by process_overdue_loans() and process_due_reminders() (run hourly via
      // pg_cron, or on-demand via the admin "Check Overdues Now" button).
      // No client-side background checks needed here anymore.
    } catch (err) {
      console.error('[useStudentDashboard] Unexpected error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { activeLoans, overdueLoans, loading, stats, error }
}