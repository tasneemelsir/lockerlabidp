import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStudentDashboard } from '../hooks/useStudentDashboard'
import { ActiveLoanCard } from '../components/ActiveLoanCard'
import { LockerQRModal } from '@/features/borrows/components/LockerQRModal'
import { useAuth } from '@/shared/context/AuthContext'
import { Card } from '@/shared/components/ui/Card'
import { Skeleton } from '@/shared/components/ui/Skeleton'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { getDaysLeft } from '@/shared/utils/dates'
import { cn } from '@/shared/utils/cn'

function StatCard({ label, value, borderColor, loading }) {
  return (
    <div className={cn('bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-5 border-l-4', borderColor)}>
      {loading ? (
        <Skeleton className="h-8 w-12 mb-2" />
      ) : (
        <p className="text-3xl font-bold text-slate-800">{value}</p>
      )}
      <p className="text-sm text-slate-500 mt-1">{label}</p>
    </div>
  )
}

export default function StudentDashboard() {
  const { profile } = useAuth()
  const { activeLoans = [], overdueLoans = [], loading, stats = {}, error } = useStudentDashboard()
  const [qrLoan, setQrLoan] = useState(null)

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Student'

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const {
    totalBorrowed = 0,
    activeCount = 0,
    overdueCount = 0,
    returnedCount = 0,
  } = stats

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          Welcome back, {firstName}
        </h1>
        <p className="text-sm text-slate-500 mt-1">{today}</p>
      </div>

      {profile?.is_flagged && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <p className="text-sm text-red-700">
            <strong>Account flagged.</strong> You have an overdue item. Please return it or contact the lab assistant to resolve this.
          </p>
        </div>
      )}

      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 text-sm text-amber-800">
          Could not load borrow data: {error}. Showing cached values.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Borrowed" value={totalBorrowed} borderColor="border-l-slate-300" loading={loading} />
        <StatCard label="Currently Active" value={activeCount} borderColor="border-l-[#0D9488]" loading={loading} />
        <StatCard label="Overdue" value={overdueCount} borderColor="border-l-red-400" loading={loading} />
        <StatCard label="Returned" value={returnedCount} borderColor="border-l-slate-300" loading={loading} />
      </div>

      {!loading && overdueLoans.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-red-700 flex items-center gap-2">
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Overdue Items
          </h2>
          {overdueLoans.map(loan => {
            const dueDate = loan.due_date
              ?? (loan.approved_at ? new Date(new Date(loan.approved_at).getTime() + 7 * 24 * 60 * 60 * 1000) : null)
            const daysOverdue = dueDate ? Math.abs(getDaysLeft(dueDate)) : '?'
            return (
              <div key={loan.id} className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-red-800">
                    {(loan.borrow_request_items ?? []).map(i => i.components?.name).filter(Boolean).join(', ') || loan.components?.name || 'Unknown component'}
                  </p>
                  <p className="text-xs text-red-600 mt-0.5">
                    {daysOverdue} day(s) overdue
                    {loan.lockers?.locker_code ? ` · Locker ${loan.lockers.locker_code}` : ''}
                  </p>
                </div>
                <Link
                  to="/my-requests"
                  className="text-xs font-medium text-red-700 underline underline-offset-2 whitespace-nowrap"
                >
                  View Details
                </Link>
              </div>
            )
          })}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-800">Active Loans</h2>
          <Link to="/my-requests" className="text-sm text-[#0D9488] hover:underline font-medium">
            View All
          </Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
          </div>
        ) : activeLoans.length === 0 ? (
          <EmptyState
            title="No active loans"
            description="You have no items currently borrowed."
            action={{ label: 'Browse Components', onClick: () => { window.location.href = '/components' } }}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeLoans.map(loan => (
              <ActiveLoanCard key={loan.id} loan={loan} onViewQR={setQrLoan} />
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-base font-semibold text-slate-800 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link to="/components">
            <Card className="flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer">
              <div className="w-10 h-10 rounded-lg bg-[#CCFBF1] flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-[#0D9488]" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-slate-800">Browse Components</p>
                <p className="text-sm text-slate-500">Find and borrow lab equipment</p>
              </div>
            </Card>
          </Link>
          <Link to="/request-item">
            <Card className="flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer">
              <div className="w-10 h-10 rounded-lg bg-[#CCFBF1] flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-[#0D9488]" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-slate-800">Request New Item</p>
                <p className="text-sm text-slate-500">Can&apos;t find what you need?</p>
              </div>
            </Card>
          </Link>
        </div>
      </div>

      <LockerQRModal
        isOpen={!!qrLoan}
        onClose={() => setQrLoan(null)}
        request={qrLoan}
      />
    </div>
  )
}
