import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/shared/lib/supabase'

export function useMyBorrowRequests() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data, error: err } = await supabase
      .from('borrow_requests')
      .select(`
        *,
        lockers:assigned_locker_id (
          id,
          locker_code,
          description
        ),
        return_locker:return_locker_id (
          id,
          locker_code
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
      .order('created_at', { ascending: false })
    if (err) setError(err.message)
    else setRequests(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { requests, loading, error, refetch: fetch }
}

// Called when the return modal opens. Does NOT change status yet.
// Finds a free locker, writes return_locker_id + return_qr_token to DB,
// marks the locker occupied, and returns { returnLocker, returnQrToken }.
export async function initReturnRequest(requestId, studentId) {
  const { data: lockers, error: lockerError } = await supabase
    .from('lockers')
    .select('id, locker_code')
    .eq('is_occupied', false)
    .order('locker_code')
    .limit(1)

  if (lockerError) throw lockerError
  if (!lockers || lockers.length === 0) {
    throw new Error('No lockers available. Contact the lab assistant.')
  }

  const returnLocker = lockers[0]
  const returnQrToken = crypto.randomUUID()

  const { error: updateError } = await supabase
    .from('borrow_requests')
    .update({
      return_locker_id:     returnLocker.id,
      return_qr_token:      returnQrToken,
      return_qr_token_used: false,
    })
    .eq('id', requestId)
  if (updateError) throw updateError

  await supabase
    .from('lockers')
    .update({ is_occupied: true })
    .eq('id', returnLocker.id)

  return { returnLocker, returnQrToken }
}

// Polls whether the Pi has scanned the return QR (sets return_qr_token_used = true).
export async function pollQrScanned(requestId) {
  const { data } = await supabase
    .from('borrow_requests')
    .select('return_qr_token_used')
    .eq('id', requestId)
    .single()
  return data?.return_qr_token_used === true
}

// Called after QR is scanned. Uploads the proof image and sets status to return_requested.
export async function submitReturnProof(requestId, studentId, imageFile, signal) {
  if (!imageFile) throw new Error('Image proof is required')
  if (signal?.aborted) return

  const path = `${studentId}/${requestId}-return.jpg`
  const { error: uploadError } = await supabase.storage
    .from('return-proofs')
    .upload(path, imageFile, { upsert: true })
  if (uploadError) throw uploadError
  if (signal?.aborted) return

  const { data: urlData } = supabase.storage
    .from('return-proofs')
    .getPublicUrl(path)

  if (signal?.aborted) return

  const { error: updateError } = await supabase
    .from('borrow_requests')
    .update({
      status:           'return_requested',
      return_image_url: urlData.publicUrl,
    })
    .eq('id', requestId)
  if (updateError) throw updateError
}
