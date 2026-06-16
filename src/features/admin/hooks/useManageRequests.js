import { useState, useEffect, useCallback } from 'react'
import { addDays } from 'date-fns'
import { supabase } from '@/shared/lib/supabase'
import { formatDate } from '@/shared/utils/dates'

export function useManageRequests() {
  const [requests, setRequests] = useState([])
  const [lockers,  setLockers]  = useState([])
  const [loading,  setLoading]  = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)

    const [{ data: requestsData }, { data: lockersData }] = await Promise.all([
      supabase
        .from('borrow_requests')
        .select(`
          *,
          profiles:student_id (
            id,
            full_name,
            student_id,
            email,
            is_flagged
          ),
          borrow_request_items (
            id,
            quantity_requested,
            components (
              id,
              name,
              category,
              quantity_available
            )
          ),
          lockers:assigned_locker_id (
            id,
            locker_code,
            description,
            is_occupied
          ),
          return_locker:return_locker_id (
            id,
            locker_code,
            description
          )
        `)
        .order('created_at', { ascending: false }),
      supabase
        .from('lockers')
        .select('id, locker_code, description, is_occupied')
        .order('locker_code'),
    ])

    setRequests(requestsData ?? [])
    setLockers(lockersData ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { refetch() }, [refetch])

  const approveRequest = useCallback(async (
    requestId,
    pickupDate,
    requestedDays,
    componentItems,
    assignedLockerId,
    studentId,
  ) => {
    const dueDate = addDays(new Date(pickupDate), Number(requestedDays))

    const { error: reqErr } = await supabase
      .from('borrow_requests')
      .update({
        status:             'active',
        borrowed_at:        new Date().toISOString(),
        pickup_date:        pickupDate,
        requested_days:     requestedDays,
        due_date:           dueDate.toISOString(),
        assigned_locker_id: assignedLockerId,
        qr_token:           crypto.randomUUID(),
        qr_token_used:      false,
      })
      .eq('id', requestId)
    if (reqErr) throw reqErr

    await supabase
      .from('lockers')
      .update({ is_occupied: true })
      .eq('id', assignedLockerId)

    for (const item of componentItems) {
      const compId = item.components?.id
      if (!compId) continue
      const { data: comp } = await supabase
        .from('components')
        .select('quantity_available')
        .eq('id', compId)
        .single()
      if (comp) {
        await supabase
          .from('components')
          .update({ quantity_available: Math.max(0, comp.quantity_available - item.quantity_requested) })
          .eq('id', compId)
      }
    }

    const { data: locker } = await supabase
      .from('lockers')
      .select('locker_code')
      .eq('id', assignedLockerId)
      .single()

    await supabase.from('notifications').insert({
      user_id: studentId,
      title:   'Request Approved',
      message: `Your request has been approved. Your items will be in Locker ${locker?.locker_code ?? '—'}. Pickup date: ${formatDate(new Date(pickupDate))}. Due date: ${formatDate(dueDate)}. Use your QR code to open the locker.`,
      is_read: false,
    })

    await refetch()
  }, [refetch])

  const rejectRequest = useCallback(async (requestId, studentId, reason) => {
    const { error } = await supabase
      .from('borrow_requests')
      .update({ status: 'rejected' })
      .eq('id', requestId)
    if (error) throw error

    await supabase.from('notifications').insert({
      user_id: studentId,
      title:   'Request Rejected',
      message: `Your borrow request was not approved. Reason: ${reason}`,
      is_read: false,
    })

    await refetch()
  }, [refetch])

  const markReturned = useCallback(async (requestId, studentId, assignedLockerId, componentItems) => {
    const { error: reqErr } = await supabase
      .from('borrow_requests')
      .update({ status: 'returned', returned_at: new Date().toISOString() })
      .eq('id', requestId)
    if (reqErr) throw reqErr

    if (assignedLockerId) {
      await supabase
        .from('lockers')
        .update({ is_occupied: false })
        .eq('id', assignedLockerId)
    }

    for (const item of (componentItems ?? [])) {
      const compId = item.components?.id
      if (!compId) continue
      const { data: comp } = await supabase
        .from('components')
        .select('quantity_available')
        .eq('id', compId)
        .single()
      if (comp) {
        await supabase
          .from('components')
          .update({ quantity_available: comp.quantity_available + item.quantity_requested })
          .eq('id', compId)
      }
    }

    await supabase.from('notifications').insert({
      user_id: studentId,
      title:   'Item Returned',
      message: 'Your item has been marked as returned by the lab assistant.',
      is_read: false,
    })

    await refetch()
  }, [refetch])

  // Return locker stays occupied — items are physically inside and admin collects manually.
  const confirmReturn = useCallback(async (requestId, componentItems, studentId) => {
    const { error: reqErr } = await supabase
      .from('borrow_requests')
      .update({ status: 'returned', returned_at: new Date().toISOString() })
      .eq('id', requestId)
    if (reqErr) throw reqErr

    for (const item of (componentItems ?? [])) {
      const compId = item.components?.id
      if (!compId) continue
      const { data: comp } = await supabase
        .from('components')
        .select('quantity_available')
        .eq('id', compId)
        .single()
      if (comp) {
        await supabase
          .from('components')
          .update({ quantity_available: comp.quantity_available + item.quantity_requested })
          .eq('id', compId)
      }
    }

    await supabase.from('notifications').insert({
      user_id: studentId,
      title:   'Return Confirmed',
      message: 'Your return has been confirmed. Thank you!',
      is_read: false,
    })

    await refetch()
  }, [refetch])

  // Free the return locker so it can be reused, then revert the request to active.
  const rejectReturn = useCallback(async (requestId, studentId, returnLockerId) => {
    const { error } = await supabase
      .from('borrow_requests')
      .update({
        status:               'active',
        return_image_url:     null,
        return_qr_token:      null,
        return_qr_token_used: false,
        return_locker_id:     null,
      })
      .eq('id', requestId)
    if (error) throw error

    if (returnLockerId) {
      await supabase
        .from('lockers')
        .update({ is_occupied: false })
        .eq('id', returnLockerId)
    }

    await supabase.from('notifications').insert({
      user_id: studentId,
      title:   'Return Rejected',
      message: 'Your return was rejected. Please ensure the item is properly returned and resubmit.',
      is_read: false,
    })

    await refetch()
  }, [refetch])

  return {
    requests, lockers, loading, refetch,
    approveRequest, rejectRequest,
    markReturned, confirmReturn, rejectReturn,
  }
}
