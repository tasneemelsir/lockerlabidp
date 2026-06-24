import { useState } from 'react'
import { useMyBorrowRequests } from '../hooks/useBorrows'
import { LockerQRModal } from '../components/LockerQRModal'
import { ReturnRequestModal } from '../components/ReturnRequestModal'
import { Badge } from '@/shared/components/ui/Badge'
import { Button } from '@/shared/components/ui/Button'
import { Skeleton } from '@/shared/components/ui/Skeleton'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { formatDate, getDaysLeft, isOverdue, getBorrowDeadline } from '@/shared/utils/dates'
import { cn } from '@/shared/utils/cn'

const TABS = ['All', 'Active', 'Pending', 'Return Requested', 'Returned', 'Overdue']

const TAB_TO_STATUS = {
  'Active':           'active',
  'Pending':          'pending',
  'Return Requested': 'return_requested',
  'Returned':         'returned',
  'Overdue':          'overdue',
}

function DueDateText({ dueDate }) {
  if (!dueDate) return null
  const overdue  = isOverdue(dueDate)
  const daysLeft = getDaysLeft(dueDate)

  if (overdue) {
    return (
      <span className="text-red-600 font-medium flex items-center gap-1">
        <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        Overdue
      </span>
    )
  }
  if (daysLeft <= 2) {
    return (
      <span className="text-amber-600 font-medium flex items-center gap-1">
        <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
        </svg>
        {daysLeft <= 0 ? 'Due today' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}
      </span>
    )
  }
  return <span className="text-slate-500">{daysLeft} days left</span>
}

function RequestCard({ request, onQRClick, onReturnClick }) {
  const dueDate = request.due_date ?? (request.approved_at ? getBorrowDeadline(request.approved_at) : null)
  const lockerCode = request.lockers?.locker_code
  const items = request.borrow_request_items ?? []
  const hasItems = items.length > 0

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          {hasItems ? (
            <h3 className="font-semibold text-slate-800 lead    ing-snug">
              {items.length} Component{items.length !== 1 ? 's' : ''} Request
            </h3>
          ) : (
            <h3 className="font-semibold text-slate-800 leading-snug">
              {request.components?.name ?? 'Unknown Component'}
            </h3>
          )}
          {(request.course_name || request.course_dr_name) && (
            <p className="text-xs text-slate-500 mt-0.5">
              {request.course_name}{request.course_name && request.course_dr_name ? ' · ' : ''}{request.course_dr_name}
            </p>
          )}
        </div>
        <Badge status={request.status} />
      </div>

      {/* Lab badge */}
      {request.lab_name && (
        <div className="mb-3">
          <span className="inline-block text-xs font-medium bg-[#CCFBF1] text-[#0D9488] px-2.5 py-1 rounded-full">
            {request.lab_name}
          </span>
        </div>
      )}

      {/* Components list */}
      {hasItems && (
        <ul className="mb-3 space-y-1 text-xs text-slate-600">
          {items.map(item => (
            <li key={item.id} className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0D9488] flex-shrink-0" />
              {item.components?.name ?? 'Unknown'} × {item.quantity_requested}
            </li>
          ))}
        </ul>
      )}

      {/* Assigned locker info box for active requests */}
      {(request.status === 'active' || request.status === 'overdue') && lockerCode && (
        <div className="mb-3 flex items-center gap-2 bg-[#F0FDFA] border border-[#CCFBF1] rounded-lg px-3 py-2">
          <svg className="w-4 h-4 text-[#0D9488] flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          <p className="text-sm font-medium text-[#0D9488]">Your items are in Locker {lockerCode}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mb-3">
        {request.pickup_date && (
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
            </svg>
            Pickup: {formatDate(request.pickup_date)}
          </span>
        )}
        {request.requested_days && (
          <span>{request.requested_days} days</span>
        )}
      </div>

      <div className="text-xs space-y-1 mb-3">
        {request.status === 'pending' && (
          <p className="text-slate-500">Requested on {formatDate(request.created_at)}</p>
        )}
        {(request.status === 'active' || request.status === 'overdue' || request.status === 'return_requested') && (
          <>
            <p className="text-slate-500">
              Borrowed on {formatDate(request.approved_at ?? request.created_at)}
              {dueDate && <> · Due {formatDate(dueDate)}</>}
            </p>
            {dueDate && <DueDateText dueDate={dueDate} />}
          </>
        )}
        {request.status === 'returned' && (
          <p className="text-slate-500">
            Returned on {request.returned_at ? formatDate(request.returned_at) : '—'}
          </p>
        )}
      </div>

      {request.status === 'active' && (
        <div className="flex flex-col gap-2">
          {request.qr_token && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => onQRClick(request)}
              className="w-full"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm2 2V5h1v1H5zM3 13a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3zm2 2v-1h1v1H5zM13 3a1 1 0 00-1 1v3a1 1 0 001 1h3a1 1 0 001-1V4a1 1 0 00-1-1h-3zm1 2v1h1V5h-1z" clipRule="evenodd" />
              </svg>
              Show Locker QR
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onReturnClick(request)}
            className="w-full"
          >
            Request Return
          </Button>
        </div>
      )}

      {request.status === 'return_requested' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-xs text-yellow-700 text-center font-medium">
          Return request submitted — awaiting admin review.
        </div>
      )}
    </div>
  )
}

export default function MyRequestsPage() {
  const { requests, loading, refetch } = useMyBorrowRequests()
  const [activeTab, setActiveTab] = useState('All')
  const [qrRequest, setQrRequest] = useState(null)
  const [returnRequest, setReturnRequest] = useState(null)

  const stats = {
    Total:   requests.length,
    Active:  requests.filter(r => r.status === 'active').length,
    Pending: requests.filter(r => r.status === 'pending').length,
    Overdue: requests.filter(r => r.status === 'overdue').length,
  }

  const filtered = requests.filter(r => {
    if (activeTab === 'All') return true
    const status = TAB_TO_STATUS[activeTab]
    return r.status === (status ?? activeTab.toLowerCase())
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">My Requests</h1>
        <p className="text-sm text-slate-500 mt-1">Track all your borrow requests and their status.</p>
      </div>

      {!loading && (
        <div className="flex flex-wrap gap-2 mb-6">
          {Object.entries(stats).map(([label, count]) => (
            <div key={label} className="flex items-center gap-1.5 bg-white border border-[#E2E8F0] rounded-full px-3 py-1.5 text-xs">
              <span className="text-slate-500">{label}</span>
              <span className="font-semibold text-slate-800">{count}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-1 border-b border-[#E2E8F0] mb-6 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              'flex-shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              activeTab === tab
                ? 'border-[#0D9488] text-[#0D9488]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-[#E2E8F0] p-5 space-y-3">
              <div className="flex justify-between">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-5 w-16" />
              </div>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={activeTab === 'All' ? 'No requests yet' : `No ${activeTab.toLowerCase()} requests`}
          description={activeTab === 'All' ? 'Browse components to make your first borrow request.' : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(req => (
            <RequestCard
              key={req.id}
              request={req}
              onQRClick={setQrRequest}
              onReturnClick={setReturnRequest}
            />
          ))}
        </div>
      )}

      <LockerQRModal
        isOpen={!!qrRequest}
        onClose={() => setQrRequest(null)}
        request={qrRequest}
      />

      <ReturnRequestModal
        isOpen={!!returnRequest}
        onClose={() => setReturnRequest(null)}
        request={returnRequest}
        onSuccess={refetch}
      />
    </div>
  )
}
