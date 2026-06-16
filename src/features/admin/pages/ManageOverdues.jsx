import { useState, useMemo } from 'react'
import { useManageOverdues } from '../hooks/useManageOverdues'
import toast from 'react-hot-toast'
import { Button } from '@/shared/components/ui/Button'
import { Modal } from '@/shared/components/ui/Modal'
import { Skeleton } from '@/shared/components/ui/Skeleton'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { getDaysLeft } from '@/shared/utils/dates'

function OverdueCard({ item, onSaveNote, savingNote, onResolve }) {
  const penalty = (item.penalties ?? []).find(p => !p.resolved) ?? item.penalties?.[0] ?? null
  const [note, setNote] = useState(penalty?.admin_note ?? '')
  const [editingNote, setEditingNote] = useState(!penalty?.admin_note)
  const daysOverdue = item.due_date ? Math.abs(getDaysLeft(item.due_date)) : '?'
  const student = item.profiles
  const component = item.components

  if (!penalty) return null

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-5 space-y-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-slate-800">{student?.full_name ?? 'Unknown'}</p>
            {student?.student_id && (
              <span className="text-xs text-slate-400 font-mono">{student.student_id}</span>
            )}
            {student?.is_flagged && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                Flagged
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{student?.email}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-red-50 rounded-lg px-4 py-3">
        <div className="flex-1">
          <p className="font-medium text-slate-800">{component?.name ?? 'Unknown component'}</p>
          {component?.lockers?.locker_code && (
            <p className="text-xs text-slate-500 mt-0.5">Locker: {component.lockers.locker_code}</p>
          )}
        </div>
        <span className="text-sm font-semibold text-red-600 whitespace-nowrap">
          Overdue by {daysOverdue} day(s)
        </span>
      </div>

      <div className="bg-slate-50 rounded-lg px-4 py-3">
        <p className="text-xs font-medium text-slate-500 mb-1">Student&apos;s Reason:</p>
        {item.notes ? (
          <p className="text-sm text-slate-700">{item.notes}</p>
        ) : (
          <p className="text-sm text-slate-400 italic">No reason provided</p>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-slate-500">Admin Note:</p>
        {penalty.admin_note && !editingNote ? (
          <div className="bg-teal-50 border border-teal-200 rounded-lg px-4 py-3 flex items-start justify-between gap-3">
            <p className="text-sm text-teal-800">{penalty.admin_note}</p>
            <button
              onClick={() => { setNote(penalty.admin_note); setEditingNote(true) }}
              className="text-xs text-teal-600 hover:text-teal-800 font-medium whitespace-nowrap"
            >
              Edit
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              placeholder="Add a note about this overdue..."
              className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#0D9488] focus:border-transparent transition resize-none"
            />
            <Button
              size="sm"
              variant="secondary"
              loading={savingNote === penalty.id}
              onClick={async () => {
                await onSaveNote(penalty.id, note)
                setEditingNote(false)
              }}
            >
              Save Note
            </Button>
          </div>
        )}
      </div>

      {!penalty.resolved && (
        <div className="pt-2 border-t border-[#E2E8F0]">
          <Button
            onClick={() => onResolve({ penaltyId: penalty.id, studentId: item.student_id, studentName: student?.full_name })}
          >
            Mark as Resolved
          </Button>
        </div>
      )}
    </div>
  )
}

export default function ManageOverdues() {
  const { overdues, loading, addPenaltyNote, resolvePenalty } = useManageOverdues()
  const [savingNote, setSavingNote] = useState(null)
  const [resolveTarget, setResolveTarget] = useState(null)
  const [resolving, setResolving] = useState(false)

  const uniqueStudents = useMemo(() => new Set(overdues.map(o => o.student_id)).size, [overdues])

  async function handleSaveNote(penaltyId, adminNote) {
    setSavingNote(penaltyId)
    try {
      await addPenaltyNote(penaltyId, adminNote)
      toast.success('Note saved')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSavingNote(null)
    }
  }

  async function handleResolve() {
    setResolving(true)
    try {
      await resolvePenalty(resolveTarget.penaltyId, resolveTarget.studentId)
      toast.success('Penalty resolved')
      setResolveTarget(null)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setResolving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-800">Overdues &amp; Penalties</h1>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Overdues &amp; Penalties</h1>

      {overdues.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 flex items-center gap-3">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <p className="text-sm font-medium text-red-700">
            {overdues.length} overdue item{overdues.length > 1 ? 's' : ''} across {uniqueStudents} student{uniqueStudents > 1 ? 's' : ''}
          </p>
        </div>
      )}

      {overdues.length === 0 ? (
        <EmptyState
          title="No overdue items"
          description="All clear! No students have overdue items at the moment."
        />
      ) : (
        <div className="space-y-4">
          {overdues.map(item => (
            <OverdueCard
              key={item.id}
              item={item}
              onSaveNote={handleSaveNote}
              savingNote={savingNote}
              onResolve={setResolveTarget}
            />
          ))}
        </div>
      )}

      <Modal isOpen={!!resolveTarget} onClose={() => setResolveTarget(null)} title="Resolve Penalty" size="sm">
        <p className="text-sm text-slate-600 mb-6">
          This will resolve the penalty for <strong>{resolveTarget?.studentName}</strong> and unflag the student if they have no other overdue items.
        </p>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => setResolveTarget(null)}>Cancel</Button>
          <Button loading={resolving} onClick={handleResolve}>Resolve Penalty</Button>
        </div>
      </Modal>
    </div>
  )
}
