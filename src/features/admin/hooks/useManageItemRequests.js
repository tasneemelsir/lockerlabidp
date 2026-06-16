import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/shared/lib/supabase'

export function useManageItemRequests() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('new_item_requests')
      .select('*, profiles(full_name, student_id)')
      .order('created_at', { ascending: false })
    if (!error) setRequests(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { refetch() }, [refetch])

  const approveRequest = useCallback(async (requestId, studentId, itemName, adminNote) => {
    const { error } = await supabase
      .from('new_item_requests')
      .update({ status: 'approved', admin_note: adminNote || null })
      .eq('id', requestId)
    if (error) throw error

    await supabase.from('notifications').insert({
      user_id: studentId,
      title: 'Item Request Approved',
      message: `Your request for "${itemName}" has been approved.${adminNote ? ` Note: ${adminNote}` : ''}`,
      is_read: false,
    })
    
    await refetch()
  }, [refetch])

  const rejectRequest = useCallback(async (requestId, studentId, itemName, adminNote) => {
    const { error } = await supabase
      .from('new_item_requests')
      .update({ status: 'rejected', admin_note: adminNote || null })
      .eq('id', requestId)
    if (error) throw error

    await supabase.from('notifications').insert({
      user_id: studentId,
      title: 'Item Request Rejected',
      message: `Your request for "${itemName}" was not approved.${adminNote ? ` ${adminNote}` : ''}`,
      is_read: false,
    })

    await refetch()
  }, [refetch])

  return { requests, loading, refetch, approveRequest, rejectRequest }
}