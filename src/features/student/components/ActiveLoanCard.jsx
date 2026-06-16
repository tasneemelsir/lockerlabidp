import { Badge } from '@/shared/components/ui/Badge'
import { getDaysLeft, isOverdue, getBorrowDeadline, formatDate } from '@/shared/utils/dates'
import { cn } from '@/shared/utils/cn'

export function ActiveLoanCard({ loan, onViewQR }) {
  const dueDate = loan.due_date ?? (loan.approved_at ? getBorrowDeadline(loan.approved_at) : null)

  const items = loan.borrow_request_items ?? []
  const hasItems = items.length > 0
  const displayNames = hasItems
    ? items.slice(0, 2).map(i => i.components?.name).filter(Boolean)
    : [loan.components?.name ?? 'Unknown Component']
  const extraCount = hasItems && items.length > 2 ? items.length - 2 : 0

  const lockerCode = loan.lockers?.locker_code

  let daysLeft = dueDate ? getDaysLeft(dueDate) : null
  const overdue = dueDate ? isOverdue(dueDate) : false

  const startDate = loan.approved_at ? new Date(loan.approved_at) : null
  const totalMs   = 7 * 24 * 60 * 60 * 1000
  const elapsedMs = startDate ? Date.now() - startDate.getTime() : 0
  const progress  = Math.min(Math.max(elapsedMs / totalMs, 0), 1)

  const progressColor = overdue
    ? 'bg-red-500'
    : daysLeft !== null && daysLeft <= 2
    ? 'bg-amber-400'
    : 'bg-[#0D9488]'

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {displayNames.map((name, idx) => (
            <p key={idx} className={cn('font-semibold text-slate-800 leading-snug', idx > 0 && 'mt-0.5 text-sm font-medium text-slate-600')}>
              {name}
            </p>
          ))}
          {extraCount > 0 && (
            <p className="text-xs text-slate-400 mt-0.5">+{extraCount} more item{extraCount !== 1 ? 's' : ''}</p>
          )}
        </div>
        <Badge status={loan.status} />
      </div>

      {/* Assigned locker pill */}
      {lockerCode && loan.status !== 'return_requested' && (
        <span className="inline-flex items-center gap-1.5 self-start text-xs font-medium text-[#0D9488] bg-[#CCFBF1] px-2.5 py-1 rounded-full">
          <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          Locker {lockerCode}
        </span>
      )}

      {dueDate && (
        <div className="text-xs">
          {overdue ? (
            <span className="text-red-600 font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
              Overdue by {Math.abs(daysLeft ?? 0)} day(s)
            </span>
          ) : daysLeft !== null && daysLeft <= 2 ? (
            <span className="text-amber-600 font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse inline-block" />
              Only {daysLeft <= 0 ? 'today' : `${daysLeft} day${daysLeft === 1 ? '' : 's'}`} left!
            </span>
          ) : (
            <span className="text-green-700 font-medium">
              {daysLeft} days left
            </span>
          )}
          <p className="text-slate-400 mt-0.5">Due {formatDate(dueDate)}</p>
        </div>
      )}

      <div
        className="h-1.5 rounded-full bg-slate-100 overflow-hidden"
        title={`${Math.round(progress * 100)}% of loan period elapsed`}
      >
        <div
          className={cn('h-full rounded-full transition-all', progressColor)}
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {loan.status === 'return_requested' ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-xs text-yellow-700 text-center font-medium">
          Return Pending
        </div>
      ) : loan.qr_token && onViewQR ? (
        <button
          type="button"
          onClick={() => onViewQR(loan)}
          className="flex items-center justify-center gap-1.5 w-full px-3 py-1.5 text-xs font-medium text-[#0D9488] border border-[#0D9488] rounded-lg hover:bg-[#CCFBF1] transition-colors"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm2 2V5h1v1H5zM3 13a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3zm2 2v-1h1v1H5zM13 3a1 1 0 00-1 1v3a1 1 0 001 1h3a1 1 0 001-1V4a1 1 0 00-1-1h-3zm1 2v1h1V5h-1z" clipRule="evenodd" />
          </svg>
          View QR
        </button>
      ) : null}
    </div>
  )
}
