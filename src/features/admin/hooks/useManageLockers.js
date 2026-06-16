import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/shared/lib/supabase'

export function useManageLockers() {
  const [lockers, setLockers] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('lockers')
      .select(`
        *,
        borrow_requests!assigned_locker_id (
          id,
          due_date,
          status,
          profiles:student_id (
            full_name,
            student_id
          )
        )
      `)
      .order('locker_code')
    setLockers(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { refetch() }, [refetch])

  const createLocker = useCallback(async (data) => {
    setCreating(true)
    const { error } = await supabase.from('lockers').insert(data)
    setCreating(false)
    if (error) throw error
    await refetch()
  }, [refetch])

  const updateLocker = useCallback(async (id, data) => {
    setUpdating(true)
    const { error } = await supabase.from('lockers').update(data).eq('id', id)
    setUpdating(false)
    if (error) throw error
    await refetch()
  }, [refetch])

  const deleteLocker = useCallback(async (id) => {
    setDeleting(true)
    const { error } = await supabase.from('lockers').delete().eq('id', id)
    setDeleting(false)
    if (error) throw error
    await refetch()
  }, [refetch])

  return { lockers, loading, refetch, createLocker, updateLocker, deleteLocker, creating, updating, deleting }
}
