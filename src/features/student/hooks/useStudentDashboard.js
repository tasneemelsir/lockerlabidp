import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/shared/lib/supabase'
import { getDaysLeft, isOverdue, getBorrowDeadline } from '@/shared/utils/dates'

async function runBackgroundChecks(loans) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    for (const loan of loans) {
      const dueDate = loan.due_date ?? (loan.approved_at ? getBorrowDeadline(loan.approved_at) : null)
      if (!dueDate) continue

      const items = loan.borrow_request_items ?? []
      const componentName = items.length > 0
        ? items.map(i => i.components?.name).filter(Boolean).join(', ')
        : loan.components?.name ?? 'an item'

      if (!loan.notified_2days && getDaysLeft(dueDate) <= 2 && !isOverdue(dueDate)) {
        const daysLeft = getDaysLeft(dueDate)
        await supabase.from('notifications').insert({
          user_id: user.id,
          title:   'Return Reminder',
          message: `Your loan of "${componentName}" is due in ${daysLeft} day(s). Please return it on time.`,
          is_read: false,
        })
        await supabase.from('borrow_requests').update({ notified_2days: true }).eq('id', loan.id)
      }

      if (isOverdue(dueDate) && loan.status !== 'overdue') {
        await supabase.from('borrow_requests').update({ status: 'overdue' }).eq('id', loan.id)
        await supabase.from('profiles').update({ is_flagged: true }).eq('id', user.id)
        await supabase.from('penalties').insert({ borrow_request_id: loan.id, student_id: user.id })
        await supabase.from('notifications').insert({
          user_id: user.id,
          title:   'Overdue Item',
          message: `Your loan of "${componentName}" is overdue. Please return it immediately or contact the lab assistant.`,
          is_read: false,
        })
      }
    }
  } catch (err) {
    console.error('[useStudentDashboard] Background check error:', err)
  }
}

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

      runBackgroundChecks([...active, ...overdue])
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
