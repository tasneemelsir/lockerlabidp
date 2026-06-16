import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/shared/lib/supabase'

export function useAdminStats() {
  const [stats, setStats] = useState({
    totalComponents: 0,
    totalLockers: 0,
    activeCount: 0,
    pendingCount: 0,
    overdueCount: 0,
    flaggedStudents: 0,
  })
  const [recentActivity, setRecentActivity] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const [
        { count: totalComponents },
        { count: totalLockers },
        { count: activeCount },
        { count: pendingCount },
        { count: overdueCount },
        { count: flaggedStudents },
        { data: activity },
      ] = await Promise.all([
        supabase.from('components').select('*', { count: 'exact', head: true }),
        supabase.from('lockers').select('*', { count: 'exact', head: true }),
        supabase.from('borrow_requests').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('borrow_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('borrow_requests').select('*', { count: 'exact', head: true }).eq('status', 'overdue'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_flagged', true),
        supabase
          .from('borrow_requests')
          .select(`
            id,
            status,
            created_at,
            course_name,
            profiles:student_id (
              full_name,
              student_id
            ),
            borrow_request_items (
              quantity_requested,
              components (
                name
              )
            )
          `)
          .order('created_at', { ascending: false })
          .limit(8),
      ])
      setStats({
        totalComponents: totalComponents ?? 0,
        totalLockers: totalLockers ?? 0,
        activeCount: activeCount ?? 0,
        pendingCount: pendingCount ?? 0,
        overdueCount: overdueCount ?? 0,
        flaggedStudents: flaggedStudents ?? 0,
      })
      setRecentActivity(activity ?? [])
    } catch (err) {
      console.error('[useAdminStats]', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { stats, recentActivity, loading, refetch: fetch }
}
