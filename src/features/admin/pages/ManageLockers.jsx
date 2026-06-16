import { useState } from 'react'
import { useManageLockers } from '../hooks/useManageLockers'
import LockerAdminQRModal from '../components/LockerAdminQRModal'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { supabase } from '@/shared/lib/supabase'
import { Button } from '@/shared/components/ui/Button'
import { Input } from '@/shared/components/ui/Input'
import { Modal } from '@/shared/components/ui/Modal'
import { Skeleton } from '@/shared/components/ui/Skeleton'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { formatDate } from '@/shared/utils/dates'
import { cn } from '@/shared/utils/cn'

const schema = z.object({
  locker_code: z.string().min(2, 'Code must be at least 2 characters'),
  description: z.string().optional(),
})

function LockerCard({ locker, onEdit, onDelete, onQR }) {
  const isOccupied = locker.is_occupied
  const activeRequest = (locker.borrow_requests ?? []).find(
    r => ['active', 'return_requested'].includes(r.status)
  )

  return (
    <div className={cn(
      'bg-white rounded-xl border shadow-sm p-5 flex flex-col gap-3 transition-all',
      isOccupied ? 'border-red-200 bg-red-50/30' : 'border-[#E2E8F0]'
    )}>
      <div className="flex items-start justify-between">
        <p className="text-2xl font-bold text-[#0D9488] tracking-wide">{locker.locker_code}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <span className={cn('inline-block w-2 h-2 rounded-full flex-shrink-0', isOccupied ? 'bg-red-500' : 'bg-green-500')} />
          <span className={cn('text-xs font-medium', isOccupied ? 'text-red-600' : 'text-green-700')}>
            {isOccupied ? 'Occupied' : 'Available'}
          </span>
        </div>
      </div>

      <div className="text-sm text-slate-600 flex-1 min-h-[3rem] bg-slate-50 p-2 rounded-md border border-slate-100">
        {isOccupied && activeRequest ? (
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-slate-700">
              In use by: {activeRequest.profiles?.full_name ?? 'Unknown'}
            </p>
            <p className="text-xs text-slate-500">
              ID: {activeRequest.profiles?.student_id ?? '—'}
            </p>
            {activeRequest.due_date && (
              <p className="text-xs text-slate-500">
                Until: {formatDate(activeRequest.due_date)}
              </p>
            )}
          </div>
        ) : locker.description ? (
          <span className="text-slate-600">{locker.description}</span>
        ) : (
          <span className="italic text-slate-300">No description</span>
        )}
      </div>

      <div className="flex items-center gap-2 pt-2 mt-auto border-t border-[#E2E8F0]">
        <Button variant="ghost" size="sm" onClick={() => onQR(locker)} title="Show locker QR">
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm2 2V5h1v1H5zM3 13a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3zm2 2v-1h1v1H5zM13 3a1 1 0 00-1 1v3a1 1 0 001 1h3a1 1 0 001-1V4a1 1 0 00-1-1h-3zm1 2v1h1V5h-1z" clipRule="evenodd" />
            <path d="M11 4a1 1 0 10-2 0v1a1 1 0 002 0V4zM10 7a1 1 0 011 1v1h2a1 1 0 110 2h-3a1 1 0 01-1-1V8a1 1 0 011-1zM16 9a1 1 0 100-2 1 1 0 000 2zM9 13a1 1 0 011-1h1a1 1 0 110 2v2a1 1 0 11-2 0v-3zM15 13a1 1 0 10-2 0v3a1 1 0 102 0v-3zM11 11a1 1 0 10-2 0v1a1 1 0 102 0v-1z" />
          </svg>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onEdit(locker)} className="flex-1">
          Edit
        </Button>
        <Button variant="danger" size="sm" onClick={() => onDelete(locker)} className="flex-1" disabled={isOccupied}>
          Delete
        </Button>
      </div>
    </div>
  )
}

export default function ManageLockers() {
  const { lockers, loading, refetch, createLocker, updateLocker, deleteLocker, creating, updating, deleting } = useManageLockers()
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [qrTarget, setQrTarget] = useState(null)
  const [syncing, setSyncing] = useState(false)

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  })

  function openAdd() {
    setEditTarget(null)
    reset({ locker_code: '', description: '' })
    setModalOpen(true)
  }

  function openEdit(locker) {
    setEditTarget(locker)
    reset({ locker_code: locker.locker_code, description: locker.description ?? '' })
    setModalOpen(true)
  }

  async function onSubmit(data) {
    try {
      const payload = { locker_code: data.locker_code.toUpperCase(), description: data.description || null }
      if (editTarget) {
        await updateLocker(editTarget.id, payload)
        toast.success('Locker updated')
      } else {
        await createLocker(payload)
        toast.success('Locker created')
      }
      setModalOpen(false)
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function handleDelete() {
    try {
      await deleteLocker(deleteTarget.id)
      toast.success('Locker deleted')
      setDeleteTarget(null)
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function handleSyncOccupancy() {
    setSyncing(true)
    try {
      const { error } = await supabase.rpc('sync_locker_occupancy')
      if (error) throw error
      await refetch()
      toast.success('Locker occupancy synced')
    } catch (err) {
      toast.error(err.message ?? 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Lockers Dashboard</h1>
          <p className="text-xs text-slate-400 mt-1">Lockers are assigned per borrow request at approval time.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={handleSyncOccupancy} loading={syncing}>
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
            Sync Occupancy
          </Button>
          <Button onClick={openAdd}>Add Locker</Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
        </div>
      ) : lockers.length === 0 ? (
        <EmptyState title="No lockers yet" description="Add lockers to start managing the lab's storage." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {lockers.map(locker => (
            <LockerCard
              key={locker.id}
              locker={locker}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
              onQR={setQrTarget}
            />
          ))}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? 'Edit Locker' : 'Add Locker'} size="sm">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Locker Code" placeholder="e.g. A1, B3" {...register('locker_code')} error={errors.locker_code?.message} />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Description</label>
            <textarea {...register('description')} rows={3} className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={creating || updating}>{editTarget ? 'Save Changes' : 'Add Locker'}</Button>
          </div>
        </form>
      </Modal>

      <LockerAdminQRModal
        isOpen={!!qrTarget}
        onClose={() => setQrTarget(null)}
        locker={qrTarget}
      />

      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Locker" size="sm">
        <div className="space-y-3 mb-6">
          <p className="text-sm text-slate-600">Are you sure you want to delete locker <strong className="text-slate-800">{deleteTarget?.locker_code}</strong>?</p>
        </div>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" loading={deleting} onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  )
}
