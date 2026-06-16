import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/shared/lib/supabase'

export function useManageOverdues() {
  const [overdues, setOverdues] = useState([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('borrow_requests')
      .select('*, profiles(full_name, student_id, email, is_flagged), lockers:assigned_locker_id(locker_code), borrow_request_items(quantity_requested, components(name)), penalties(*)')
      .eq('status', 'overdue')
      .order('created_at', { ascending: false })
    if (!error) setOverdues(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { refetch() }, [refetch])

  const addPenaltyNote = useCallback(async (penaltyId, adminNote) => {
    const { error } = await supabase
      .from('penalties')
      .update({ admin_note: adminNote })
      .eq('id', penaltyId)
    if (error) throw error
    await refetch()
  }, [refetch])

  const resolvePenalty = useCallback(async (penaltyId, studentId) => {
    const { error } = await supabase
      .from('penalties')
      .update({ resolved: true })
      .eq('id', penaltyId)
    if (error) throw error

    const { data: remaining } = await supabase
      .from('penalties')
      .select('id')
      .eq('student_id', studentId)
      .eq('resolved', false)

    if (!remaining || remaining.length === 0) {
      await supabase.from('profiles').update({ is_flagged: false }).eq('id', studentId)
    }

    await supabase.from('notifications').insert({
      user_id: studentId,
      title: 'Penalty Resolved',
      message: 'Your overdue penalty has been resolved by the lab assistant.',
      is_read: false,
    })

    await refetch()
  }, [refetch])

  return { overdues, loading, refetch, addPenaltyNote, resolvePenalty }
}
