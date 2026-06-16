import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/shared/lib/supabase'

export function useSubmitItemRequest() {
  const [loading, setLoading] = useState(false)

  const submit = useCallback(async (itemName, reason, labName, neededBy) => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('new_item_requests').insert({
      student_id: user.id,
      item_name:  itemName,
      reason,
      lab_name:   labName,
      needed_by:  neededBy,
    })
    setLoading(false)
    if (error) throw error
  }, [])

  return { submit, loading }
}

export function useMyItemRequests() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data } = await supabase
      .from('new_item_requests')
      .select('*')
      .eq('student_id', user.id)
      .order('created_at', { ascending: false })
    setRequests(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { requests, loading, refetch: fetch }
}
