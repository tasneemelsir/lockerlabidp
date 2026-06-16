import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/shared/lib/supabase'

export function useManageStudents() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*, borrow_requests(status)')
      .eq('role', 'student')
      .order('created_at', { ascending: false })
    if (!error) setStudents(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { refetch() }, [refetch])

  return { students, loading, refetch }
}

export function useStudentBorrowHistory(studentId) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchHistory = async () => {
    if (!studentId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('borrow_requests')
      .select(`
        *,
        lockers:assigned_locker_id (
          locker_code
        ),
        return_locker:return_locker_id (
          locker_code
        ),
        borrow_request_items (
          quantity_requested,
          components (
            id,
            name,
            category
          )
        )
      `)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })

    if (!error) setHistory(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    fetchHistory()
  }, [studentId]) // eslint-disable-line react-hooks/exhaustive-deps

  return { history, loading }
}
