import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/shared/lib/supabase'

export function useAllComponents() {
  const [components, setComponents] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('components')
      .select('*')
      .order('name')
    if (!error) setComponents(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { components, loading, refetch: fetch }
}

export function useCreateComponent() {
  const [loading, setLoading] = useState(false)

  const create = useCallback(async (data) => {
    setLoading(true)
    const { error } = await supabase.from('components').insert(data)
    setLoading(false)
    if (error) throw error
  }, [])

  return { create, loading }
}

export function useUpdateComponent() {
  const [loading, setLoading] = useState(false)

  const update = useCallback(async (id, data) => {
    setLoading(true)
    const { error } = await supabase.from('components').update(data).eq('id', id)
    setLoading(false)
    if (error) throw error
  }, [])

  return { update, loading }
}

export function useDeleteComponent() {
  const [loading, setLoading] = useState(false)

  const remove = useCallback(async (id) => {
    setLoading(true)
    const { error } = await supabase.from('components').delete().eq('id', id)
    setLoading(false)
    if (error) throw error
  }, [])

  return { remove, loading }
}
