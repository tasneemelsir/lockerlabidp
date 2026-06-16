import { useState, useMemo } from 'react'
import { useManageStudents, useStudentBorrowHistory } from '../hooks/useManageStudents'
import { Table } from '@/shared/components/ui/Table'
import { Modal } from '@/shared/components/ui/Modal'
import { Badge } from '@/shared/components/ui/Badge'
import { Button } from '@/shared/components/ui/Button'
import { Skeleton } from '@/shared/components/ui/Skeleton'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { formatDate } from '@/shared/utils/dates'
import { cn } from '@/shared/utils/cn'

function HistoryModal({ student, onClose }) {
  const { history, loading } = useStudentBorrowHistory(student?.id)

  return (
    <Modal isOpen={!!student} onClose={onClose} title={`${student?.full_name ?? 'Student'} — Borrow History`} size="lg">
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 rounded" />)}
        </div>
      ) : history.length === 0 ? (
        <EmptyState title="No borrow history" description="This student hasn't borrowed any items yet." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E2E8F0]">
                {['Components', 'Assigned Locker', 'Return Locker', 'Status', 'Borrowed', 'Due', 'Returned'].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map(row => {
                const items = row.borrow_request_items ?? []
                const names = items.map(i => i.components?.name).filter(Boolean)
                const showReturnLocker = row.status === 'returned' || row.status === 'return_requested'
                return (
                  <tr key={row.id} className="border-b border-[#E2E8F0] last:border-0">
                    <td className="px-3 py-2.5 font-medium text-slate-800 max-w-[200px]">
                      {names.length > 0 ? names.join(', ') : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">
                      {row.lockers?.locker_code ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">
                      {showReturnLocker ? (row.return_locker?.locker_code ?? '—') : '—'}
                    </td>
                    <td className="px-3 py-2.5"><Badge status={row.status} /></td>
                    <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{row.borrowed_at ? formatDate(row.borrowed_at) : '—'}</td>
                    <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{row.due_date ? formatDate(row.due_date) : '—'}</td>
                    <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{row.returned_at ? formatDate(row.returned_at) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}

export default function ManageStudents() {
  const { students, loading } = useManageStudents()
  const [search, setSearch] = useState('')
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false)
  const [historyStudent, setHistoryStudent] = useState(null)

  const filtered = useMemo(() => students.filter(s => {
    const matchSearch = !search ||
      s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.student_id?.toLowerCase().includes(search.toLowerCase())
    const matchFlagged = !showFlaggedOnly || s.is_flagged
    return matchSearch && matchFlagged
  }), [students, search, showFlaggedOnly])

  const columns = [
    {
      key: 'full_name', label: 'Student',
      render: (v, row) => (
        <div>
          <p className="font-medium text-slate-800">{v ?? '—'}</p>
          <p className="text-xs text-slate-400 font-mono mt-0.5">{row.student_id ?? ''}</p>
        </div>
      ),
    },
    {
      key: 'email', label: 'Email',
      render: (v) => <span className="text-slate-600 text-sm">{v ?? '—'}</span>,
    },
    {
      key: 'created_at', label: 'Joined',
      render: (v) => <span className="text-sm text-slate-500 whitespace-nowrap">{formatDate(v)}</span>,
    },
    {
      key: 'is_flagged', label: 'Status',
      render: (v) => (
        <span className={cn(
          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
          v ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
        )}>
          {v ? 'Flagged' : 'Active'}
        </span>
      ),
    },
    {
      key: 'borrow_requests', label: 'Active Borrows',
      render: (v) => (
        <span className="text-slate-600 tabular-nums">
          {(v ?? []).filter(r => r.status === 'active').length}
        </span>
      ),
    },
    {
      key: 'id', label: 'Actions',
      render: (_, row) => (
        <Button variant="ghost" size="sm" onClick={() => setHistoryStudent(row)}>
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
            <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
          </svg>
          View History
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Students</h1>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <input
          type="text"
          placeholder="Search by name or student ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-2 rounded-lg border border-[#E2E8F0] text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0D9488] focus:border-transparent transition sm:w-72"
        />
        <div className="flex gap-2">
          <button
            onClick={() => setShowFlaggedOnly(false)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              !showFlaggedOnly
                ? 'bg-[#0D9488] text-white'
                : 'bg-white border border-[#E2E8F0] text-slate-600 hover:border-[#0D9488] hover:text-[#0D9488]'
            )}
          >
            All Students
          </button>
          <button
            onClick={() => setShowFlaggedOnly(true)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              showFlaggedOnly
                ? 'bg-red-500 text-white'
                : 'bg-white border border-[#E2E8F0] text-slate-600 hover:border-red-300 hover:text-red-600'
            )}
          >
            Flagged Only
          </button>
        </div>
      </div>

      <Table columns={columns} data={filtered} loading={loading} emptyMessage="No students found" />

      <HistoryModal student={historyStudent} onClose={() => setHistoryStudent(null)} />
    </div>
  )
}
