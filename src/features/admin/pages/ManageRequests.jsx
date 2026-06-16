import { useState, useMemo, useEffect } from 'react'
import { useManageRequests } from '../hooks/useManageRequests'
import { ReturnProofModal } from '../components/ReturnProofModal'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Button } from '@/shared/components/ui/Button'
import { Modal } from '@/shared/components/ui/Modal'
import { Badge } from '@/shared/components/ui/Badge'
import { Skeleton } from '@/shared/components/ui/Skeleton'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { formatDate, isOverdue } from '@/shared/utils/dates'
import { cn } from '@/shared/utils/cn'

const rejectSchema = z.object({ reason: z.string().min(1, 'Please provide a reason') })

const approveSchema = z.object({
  pickup_date:    z.string().min(1, 'Pickup date is required'),
  requested_days: z.coerce.number().int().min(1, 'Minimum 1 day').max(30, 'Maximum 30 days'),
})

const TABS = ['All', 'Pending', 'Active', 'Return Requested', 'Returned', 'Overdue', 'Rejected']

const TAB_TO_STATUS = {
  'Pending':          'pending',
  'Active':           'active',
  'Return Requested': 'return_requested',
  'Returned':         'returned',
  'Overdue':          'overdue',
  'Rejected':         'rejected',
}

function formatDueDate(pickupDate, days) {
  if (!pickupDate || !days || days < 1) return null
  const d = new Date(pickupDate)
  if (isNaN(d.getTime())) return null
  d.setDate(d.getDate() + Number(days))
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function ManageRequests() {
  const { requests, lockers, loading, approveRequest, rejectRequest, markReturned, confirmReturn, rejectReturn } = useManageRequests()

  const [activeTab,     setActiveTab]     = useState('All')
  const [approveTarget, setApproveTarget] = useState(null)
  const [rejectTarget,  setRejectTarget]  = useState(null)
  const [returnTarget,  setReturnTarget]  = useState(null)
  const [proofTarget,   setProofTarget]   = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  const [assignedLockerId, setAssignedLockerId] = useState('')
  const [submitAttempted,  setSubmitAttempted]  = useState(false)

  useEffect(() => {
    if (!approveTarget) {
      setAssignedLockerId('')
      setSubmitAttempted(false)
    }
  }, [approveTarget])

  const {
    register:     regReject,
    handleSubmit: handleRejectSubmit,
    reset:        resetReject,
    formState:    { errors: rejectErrors },
  } = useForm({ resolver: zodResolver(rejectSchema) })

  const {
    register:     regApprove,
    handleSubmit: handleApproveSubmit,
    reset:        resetApprove,
    formState:    { errors: approveErrors },
    watch:        watchApprove,
  } = useForm({ resolver: zodResolver(approveSchema) })

  const watchedPickupDate    = watchApprove('pickup_date')
  const watchedRequestedDays = watchApprove('requested_days')
  const previewDueDate       = formatDueDate(watchedPickupDate, watchedRequestedDays)

  const approveItems   = approveTarget?.borrow_request_items ?? []
  const stockIssues    = approveItems.filter(
    i => typeof i.components?.quantity_available === 'number' &&
         i.components.quantity_available < i.quantity_requested
  )
  const hasStockIssues = stockIssues.length > 0

  const tabCounts = useMemo(() => {
    const counts = { All: requests.length }
    Object.entries(TAB_TO_STATUS).forEach(([tab, status]) => {
      counts[tab] = requests.filter(r => r.status === status).length
    })
    return counts
  }, [requests])

  const filtered = useMemo(() => {
    if (activeTab === 'All') return requests
    const status = TAB_TO_STATUS[activeTab]
    return requests.filter(r => r.status === status)
  }, [requests, activeTab])

  function openApprove(req) {
    setApproveTarget(req)
    resetApprove({
      pickup_date:    req.pickup_date    ?? '',
      requested_days: req.requested_days ?? 7,
    })
  }

  async function handleApprove({ pickup_date, requested_days }) {
    if (!assignedLockerId) return
    if (hasStockIssues)    return

    setActionLoading(true)
    try {
      await approveRequest(
        approveTarget.id,
        pickup_date,
        Number(requested_days),
        approveItems,
        assignedLockerId,
        approveTarget.student_id,
      )
      toast.success('Request approved')
      setApproveTarget(null)
      resetApprove()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleReject({ reason }) {
    setActionLoading(true)
    try {
      await rejectRequest(rejectTarget.id, rejectTarget.student_id, reason)
      toast.success('Request rejected')
      setRejectTarget(null)
      resetReject()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleMarkReturned() {
    setActionLoading(true)
    try {
      await markReturned(
        returnTarget.id,
        returnTarget.student_id,
        returnTarget.assigned_locker_id,
        returnTarget.borrow_request_items ?? [],
      )
      toast.success('Marked as returned')
      setReturnTarget(null)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleConfirmReturn(req) {
    setActionLoading(true)
    try {
      await confirmReturn(
        req.id,
        req.borrow_request_items ?? [],
        req.student_id,
      )
      toast.success('Return confirmed')
      if (proofTarget?.id === req.id) setProofTarget(null)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleRejectReturn(req) {
    setActionLoading(true)
    try {
      await rejectReturn(req.id, req.student_id, req.return_locker_id)
      toast.success('Return rejected')
      if (proofTarget?.id === req.id) setProofTarget(null)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  function rowBg(status) {
    if (status === 'overdue')          return 'bg-red-50 hover:bg-red-100/70'
    if (status === 'return_requested') return 'bg-yellow-50 hover:bg-yellow-100/70'
    return 'hover:bg-slate-50'
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Borrow Requests</h1>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-[#E2E8F0]">
        {TABS.map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === tab
                ? 'border-[#0D9488] text-[#0D9488]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            )}
          >
            {tab}
            <span className={cn(
              'ml-1.5 px-1.5 py-0.5 rounded-full text-xs font-medium',
              activeTab === tab ? 'bg-[#CCFBF1] text-[#0D9488]' : 'bg-slate-100 text-slate-500'
            )}>
              {tabCounts[tab] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="w-full overflow-x-auto rounded-xl border border-[#E2E8F0]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-[#E2E8F0]">
              {['Student', 'Components', 'Locker', 'Return Locker', 'Course / Lab', 'Status', 'Requested', 'Due Date', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-[#E2E8F0]">
                  {Array.from({ length: 9 }).map((__, j) => (
                    <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9}><EmptyState title="No requests found" /></td></tr>
            ) : filtered.map(req => {
              const items     = req.borrow_request_items ?? []
              const hasItems  = items.length > 0
              const firstName = items[0]?.components?.name ?? 'Unknown'
              const moreCount = items.length - 1
              const showReturnLocker = req.status === 'return_requested' || req.status === 'returned'

              return (
                <tr
                  key={req.id}
                  className={cn('border-b border-[#E2E8F0] last:border-0 transition-colors', rowBg(req.status))}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-800">{req.profiles?.full_name ?? 'Unknown'}</p>
                      {req.profiles?.is_flagged && (
                        <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">Flagged</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{req.profiles?.student_id ?? '—'}</p>
                  </td>

                  <td className="px-4 py-3 max-w-[200px]">
                    {hasItems ? (
                      <div>
                        <p className="text-sm text-slate-700">
                          {firstName}
                          {moreCount > 0 && <span className="text-slate-400"> +{moreCount} more</span>}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">{items.length} item{items.length !== 1 ? 's' : ''}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-700">{req.components?.name ?? 'Unknown'}</p>
                    )}
                  </td>

                  {/* Borrow locker (assigned at approval) */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {req.lockers?.locker_code ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#0D9488] bg-[#CCFBF1] px-2 py-0.5 rounded-full">
                        <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                        {req.lockers.locker_code}
                      </span>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>

                  {/* Return locker (auto-assigned when student submits return) */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {showReturnLocker && req.return_locker?.locker_code ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                        <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                        {req.return_locker.locker_code}
                      </span>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>

                  <td className="px-4 py-3 max-w-[160px]">
                    {req.course_name && <p className="text-xs text-slate-700 font-medium truncate">{req.course_name}</p>}
                    {req.course_dr_name && <p className="text-xs text-slate-500 truncate">{req.course_dr_name}</p>}
                    {req.lab_name && (
                      <span className="inline-block mt-1 text-[10px] bg-[#CCFBF1] text-[#0D9488] px-1.5 py-0.5 rounded-full font-medium truncate max-w-[140px]">
                        {req.lab_name}
                      </span>
                    )}
                    {req.pickup_date && (
                      <p className="text-xs text-slate-400 mt-0.5">Pickup: {formatDate(req.pickup_date)}</p>
                    )}
                  </td>

                  <td className="px-4 py-3"><Badge status={req.status} /></td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(req.created_at)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {req.due_date && (req.status === 'active' || req.status === 'overdue' || req.status === 'return_requested') ? (
                      <span className={cn('text-sm font-medium', isOverdue(req.due_date) ? 'text-red-600' : 'text-slate-600')}>
                        {formatDate(req.due_date)}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {req.status === 'pending' && (
                      <div className="flex items-center gap-2">
                        <Button size="sm" onClick={() => openApprove(req)}>Approve</Button>
                        <Button variant="danger" size="sm" onClick={() => setRejectTarget(req)}>Reject</Button>
                      </div>
                    )}
                    {(req.status === 'active' || req.status === 'overdue') && (
                      <Button variant="secondary" size="sm" onClick={() => setReturnTarget(req)}>Mark Returned</Button>
                    )}
                    {req.status === 'return_requested' && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Button variant="ghost" size="sm" onClick={() => setProofTarget(req)}>
                          <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                            <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                          </svg>
                          View Proof
                        </Button>
                        <Button size="sm" loading={actionLoading} onClick={() => handleConfirmReturn(req)}>Confirm</Button>
                        <Button variant="danger" size="sm" loading={actionLoading} onClick={() => handleRejectReturn(req)}>Reject</Button>
                      </div>
                    )}
                    {(req.status === 'returned' || req.status === 'rejected') && (
                      <span className="text-slate-300 text-sm">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Approve Modal ── */}
      <Modal
        isOpen={!!approveTarget}
        onClose={() => { setApproveTarget(null); resetApprove() }}
        title="Approve Request"
        size="md"
      >
        {/* Section 1 — Student Info */}
        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-[#E2E8F0]">
          <div className="w-9 h-9 rounded-full bg-[#0D9488] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {approveTarget?.profiles?.full_name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <p className="font-semibold text-slate-800">{approveTarget?.profiles?.full_name}</p>
            <p className="text-xs text-slate-400">{approveTarget?.profiles?.student_id}</p>
          </div>
        </div>

        {/* Section 2 — Requested Items */}
        {approveItems.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Requested Items</p>
            <div className="rounded-lg border border-[#E2E8F0] overflow-hidden">
              {approveItems.map(item => {
                const avail    = item.components?.quantity_available
                const hasStock = typeof avail === 'number' ? avail >= item.quantity_requested : true
                return (
                  <div
                    key={item.id}
                    className={cn(
                      'flex items-center justify-between px-3 py-2.5 border-b border-[#E2E8F0] last:border-0',
                      !hasStock && 'bg-red-50'
                    )}
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-700">{item.components?.name}</p>
                      <p className="text-xs mt-0.5">
                        <span className="text-slate-400">Qty: {item.quantity_requested}</span>
                        {typeof avail === 'number' && (
                          <span className={cn('ml-2', hasStock ? 'text-green-600' : 'text-red-500 font-medium')}>
                            {hasStock ? `${avail} in stock` : `Only ${avail} in stock — insufficient`}
                          </span>
                        )}
                      </p>
                    </div>
                    <span className="text-xs text-slate-400 ml-3 flex-shrink-0">{item.components?.category}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Stock warning banner */}
        {hasStockIssues && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-3 flex items-start gap-2">
            <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-xs text-red-700">
              Some items have insufficient stock. Please update inventory before approving.
            </p>
          </div>
        )}

        {/* Section 3 — Request Details */}
        {(approveTarget?.course_name || approveTarget?.course_dr_name || approveTarget?.lab_name || approveTarget?.reason) && (
          <div className="mb-4 rounded-lg bg-slate-50 border border-[#E2E8F0] px-3 py-3 space-y-1.5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Request Details</p>
            {approveTarget?.course_name && (
              <p className="text-xs text-slate-600"><span className="font-medium text-slate-700">Course:</span> {approveTarget.course_name}</p>
            )}
            {approveTarget?.course_dr_name && (
              <p className="text-xs text-slate-600"><span className="font-medium text-slate-700">Lecturer:</span> {approveTarget.course_dr_name}</p>
            )}
            {approveTarget?.lab_name && (
              <p className="text-xs text-slate-600"><span className="font-medium text-slate-700">Lab:</span> {approveTarget.lab_name}</p>
            )}
            {approveTarget?.reason && (
              <p className="text-xs text-slate-600"><span className="font-medium text-slate-700">Reason:</span> {approveTarget.reason}</p>
            )}
          </div>
        )}

        <form onSubmit={handleApproveSubmit(handleApprove)} className="space-y-4">
          {/* Section 4 — Locker Assignment */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">
              Assign Locker <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-slate-400">Select one locker for all items in this request</p>
            <select
              value={assignedLockerId}
              onChange={e => setAssignedLockerId(e.target.value)}
              className="w-full text-sm border border-[#E2E8F0] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0D9488] bg-white text-slate-900 mt-1"
            >
              <option value="">Select a locker...</option>
              {lockers.map(l => (
                <option key={l.id} value={l.id} disabled={l.is_occupied}>
                  {l.locker_code}{l.description ? ` — ${l.description}` : ''}{l.is_occupied ? ' (Occupied)' : ' (Available)'}
                </option>
              ))}
            </select>
            {!assignedLockerId && submitAttempted && (
              <p className="text-red-500 text-xs mt-1">Please assign a locker before approving</p>
            )}
          </div>

          {/* Section 5 — Pickup Date + Duration */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">
              Pickup Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              {...regApprove('pickup_date')}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#0D9488] focus:border-transparent transition"
            />
            {approveErrors.pickup_date && (
              <p className="text-xs text-red-500">{approveErrors.pickup_date.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">
              Loan Duration (days) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={1}
              max={30}
              {...regApprove('requested_days')}
              className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#0D9488] focus:border-transparent transition"
            />
            {approveErrors.requested_days && (
              <p className="text-xs text-red-500">{approveErrors.requested_days.message}</p>
            )}
            {previewDueDate && (
              <p className="text-xs text-slate-500 mt-0.5">
                Due date: <strong className="text-slate-700">{previewDueDate}</strong>
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={() => { setApproveTarget(null); resetApprove() }}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={actionLoading}
              disabled={hasStockIssues}
              onClick={() => setSubmitAttempted(true)}
            >
              {hasStockIssues ? 'Cannot Approve — Stock Issue' : 'Approve Request'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Reject Modal ── */}
      <Modal
        isOpen={!!rejectTarget}
        onClose={() => { setRejectTarget(null); resetReject() }}
        title="Reject Request"
        size="sm"
      >
        <p className="text-sm text-slate-600 mb-4">
          Rejecting request by <strong>{rejectTarget?.profiles?.full_name}</strong>.
        </p>
        <form onSubmit={handleRejectSubmit(handleReject)} className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Reason for rejection</label>
            <textarea
              {...regReject('reason')}
              rows={3}
              placeholder="Provide a reason..."
              className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#0D9488] focus:border-transparent transition resize-none"
            />
            {rejectErrors.reason && <p className="text-xs text-red-500">{rejectErrors.reason.message}</p>}
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={() => { setRejectTarget(null); resetReject() }}>Cancel</Button>
            <Button variant="danger" type="submit" loading={actionLoading}>Reject Request</Button>
          </div>
        </form>
      </Modal>

      {/* ── Mark Returned Modal ── */}
      <Modal isOpen={!!returnTarget} onClose={() => setReturnTarget(null)} title="Mark as Returned" size="sm">
        <p className="text-sm text-slate-600 mb-6">
          Confirm that <strong>{returnTarget?.profiles?.full_name}</strong> has returned all items?
        </p>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => setReturnTarget(null)}>Cancel</Button>
          <Button loading={actionLoading} onClick={handleMarkReturned}>Confirm Return</Button>
        </div>
      </Modal>

      {/* ── Return Proof Modal ── */}
      <ReturnProofModal
        isOpen={!!proofTarget}
        onClose={() => setProofTarget(null)}
        request={proofTarget}
        loading={actionLoading}
        onConfirm={() => handleConfirmReturn(proofTarget)}
        onReject={() => handleRejectReturn(proofTarget)}
      />
    </div>
  )
}
