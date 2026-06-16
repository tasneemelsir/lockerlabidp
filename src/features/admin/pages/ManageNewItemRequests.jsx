import { useState, useMemo } from 'react'
import { useManageItemRequests } from '../hooks/useManageItemRequests'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Button } from '@/shared/components/ui/Button'
import { Modal } from '@/shared/components/ui/Modal'
import { Badge } from '@/shared/components/ui/Badge'
import { Table } from '@/shared/components/ui/Table'
import { formatDate } from '@/shared/utils/dates'
import { cn } from '@/shared/utils/cn'

const approveSchema = z.object({ admin_note: z.string().optional() })
const rejectSchema = z.object({ admin_note: z.string().min(1, 'Please provide a reason') })

const TABS = ['All', 'Pending', 'Approved', 'Rejected']

export default function ManageNewItemRequests() {
  const { requests, loading, approveRequest, rejectRequest } = useManageItemRequests()
  const [activeTab, setActiveTab] = useState('All')
  const [approveTarget, setApproveTarget] = useState(null)
  const [rejectTarget, setRejectTarget] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  const {
    register: regApprove,
    handleSubmit: handleApproveSubmit,
    reset: resetApprove,
  } = useForm({ resolver: zodResolver(approveSchema) })

  const {
    register: regReject,
    handleSubmit: handleRejectSubmit,
    reset: resetReject,
    formState: { errors: rejectErrors },
  } = useForm({ resolver: zodResolver(rejectSchema) })

  const tabCounts = useMemo(() => {
    const counts = { All: requests.length }
    TABS.slice(1).forEach(t => { counts[t] = requests.filter(r => r.status === t.toLowerCase()).length })
    return counts
  }, [requests])

  const filtered = useMemo(() => {
    if (activeTab === 'All') return requests
    return requests.filter(r => r.status === activeTab.toLowerCase())
  }, [requests, activeTab])

  async function handleApprove({ admin_note }) {
    setActionLoading(true)
    try {
      await approveRequest(approveTarget.id, approveTarget.student_id, approveTarget.item_name, admin_note)
      toast.success('Request approved')
      setApproveTarget(null)
      resetApprove()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleReject({ admin_note }) {
    setActionLoading(true)
    try {
      await rejectRequest(rejectTarget.id, rejectTarget.student_id, rejectTarget.item_name, admin_note)
      toast.success('Request rejected')
      setRejectTarget(null)
      resetReject()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const columns = [
    {
      key: 'profiles', label: 'Student',
      render: (v) => (
        <div>
          <p className="font-medium text-slate-800">{v?.full_name ?? '—'}</p>
          <p className="text-xs text-slate-400">{v?.student_id ?? ''}</p>
        </div>
      ),
    },
    {
      key: 'item_name', label: 'Item Name',
      render: (v) => <span className="font-medium text-slate-700">{v}</span>,
    },
    {
      key: 'description', label: 'Description',
      render: (v) => v ? (
        <span className="text-slate-500 text-sm" title={v}>
          {v.length > 60 ? v.slice(0, 60) + '...' : v}
        </span>
      ) : <span className="text-slate-300 italic text-sm">—</span>,
    },
    {
      key: 'lab_name', label: 'Lab',
      render: (v) => v
        ? <span className="text-slate-600 text-sm">{v}</span>
        : <span className="text-slate-300 text-sm">—</span>,
    },
    {
      key: 'needed_by', label: 'Needed By',
      render: (v) => v
        ? <span className="text-sm text-slate-500">{formatDate(v)}</span>
        : <span className="text-slate-300 text-sm">—</span>,
    },
    {
      key: 'status', label: 'Status',
      render: (v) => <Badge status={v} />,
    },
    {
      key: 'created_at', label: 'Requested',
      render: (v) => <span className="text-sm text-slate-500">{formatDate(v)}</span>,
    },
    {
      key: 'admin_note', label: 'Admin Note',
      render: (v) => v ? (
        <span className="text-slate-500 text-sm" title={v}>{v.length > 40 ? v.slice(0, 40) + '...' : v}</span>
      ) : <span className="text-slate-300 text-sm">—</span>,
    },
    {
      key: 'id', label: 'Actions',
      render: (_, row) => row.status === 'pending' ? (
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setApproveTarget(row)}>Approve</Button>
          <Button variant="danger" size="sm" onClick={() => setRejectTarget(row)}>Reject</Button>
        </div>
      ) : <span className="text-slate-300 text-sm">—</span>,
    },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">New Item Requests</h1>

      <div className="flex flex-wrap gap-1 border-b border-[#E2E8F0]">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === tab ? 'border-[#0D9488] text-[#0D9488]' : 'border-transparent text-slate-500 hover:text-slate-700'
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

      <Table columns={columns} data={filtered} loading={loading} emptyMessage="No item requests found" />

      {/* Approve Modal */}
      <Modal
        isOpen={!!approveTarget}
        onClose={() => { setApproveTarget(null); resetApprove() }}
        title="Approve Request"
        size="sm"
      >
        <div className="space-y-3 mb-4">
          <p className="text-sm text-slate-600">
            Approving request for <strong>{approveTarget?.item_name}</strong> by{' '}
            <strong>{approveTarget?.profiles?.full_name}</strong>.
          </p>
          {approveTarget?.lab_name && (
            <div className="flex gap-2 text-sm">
              <span className="text-slate-500 font-medium min-w-[60px]">Lab:</span>
              <span className="text-slate-700">{approveTarget.lab_name}</span>
            </div>
          )}
          {approveTarget?.needed_by && (
            <div className="flex gap-2 text-sm">
              <span className="text-slate-500 font-medium min-w-[60px]">Needed by:</span>
              <span className="text-slate-700">{formatDate(approveTarget.needed_by)}</span>
            </div>
          )}
          {approveTarget?.reason && (
            <div className="text-sm">
              <p className="text-slate-500 font-medium mb-1">Reason:</p>
              <p className="text-slate-700 bg-slate-50 rounded-lg px-3 py-2 text-xs leading-relaxed">
                {approveTarget.reason}
              </p>
            </div>
          )}
        </div>
        <form onSubmit={handleApproveSubmit(handleApprove)} className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Note for student (optional)</label>
            <textarea
              {...regApprove('admin_note')}
              rows={3}
              placeholder="Add a note..."
              className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#0D9488] focus:border-transparent transition resize-none"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => { setApproveTarget(null); resetApprove() }}>Cancel</Button>
            <Button type="submit" loading={actionLoading}>Approve</Button>
          </div>
        </form>
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={!!rejectTarget}
        onClose={() => { setRejectTarget(null); resetReject() }}
        title="Reject Request"
        size="sm"
      >
        <div className="space-y-3 mb-4">
          <p className="text-sm text-slate-600">
            Rejecting request for <strong>{rejectTarget?.item_name}</strong> by{' '}
            <strong>{rejectTarget?.profiles?.full_name}</strong>.
          </p>
          {rejectTarget?.lab_name && (
            <div className="flex gap-2 text-sm">
              <span className="text-slate-500 font-medium min-w-[60px]">Lab:</span>
              <span className="text-slate-700">{rejectTarget.lab_name}</span>
            </div>
          )}
          {rejectTarget?.needed_by && (
            <div className="flex gap-2 text-sm">
              <span className="text-slate-500 font-medium min-w-[60px]">Needed by:</span>
              <span className="text-slate-700">{formatDate(rejectTarget.needed_by)}</span>
            </div>
          )}
          {rejectTarget?.reason && (
            <div className="text-sm">
              <p className="text-slate-500 font-medium mb-1">Reason:</p>
              <p className="text-slate-700 bg-slate-50 rounded-lg px-3 py-2 text-xs leading-relaxed">
                {rejectTarget.reason}
              </p>
            </div>
          )}
        </div>
        <form onSubmit={handleRejectSubmit(handleReject)} className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Reason for rejection</label>
            <textarea
              {...regReject('admin_note')}
              rows={3}
              placeholder="Provide a reason..."
              className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#0D9488] focus:border-transparent transition resize-none"
            />
            {rejectErrors.admin_note && <p className="text-xs text-red-500">{rejectErrors.admin_note.message}</p>}
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => { setRejectTarget(null); resetReject() }}>Cancel</Button>
            <Button variant="danger" type="submit" loading={actionLoading}>Reject</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
