import { Link, useNavigate } from 'react-router-dom'
import { useAdminStats } from '../hooks/useAdminStats'
import { Skeleton } from '@/shared/components/ui/Skeleton'
import { Badge } from '@/shared/components/ui/Badge'
import { getRelativeTime } from '@/shared/utils/dates'
import { cn } from '@/shared/utils/cn'

function StatCard({ label, value, accentClass, icon, pulse, loading }) {
  return (
    <div className={cn('bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-5 border-l-4', accentClass)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {loading ? (
            <Skeleton className="h-8 w-16 mb-1.5" />
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-3xl font-bold text-slate-800">{value}</p>
              {pulse && value > 0 && (
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-current" />
                </span>
              )}
            </div>
          )}
          <p className="text-sm text-slate-500 mt-1">{label}</p>
        </div>
        <div className="text-slate-300 mt-0.5">{icon}</div>
      </div>
    </div>
  )
}

function getComponentSummary(activity) {
  const items = activity.borrow_request_items ?? []
  if (items.length === 0) return 'Unknown Component'
  const first = items[0]?.components?.name ?? 'Unknown'
  const rest  = items.length - 1
  return rest > 0 ? `${first} +${rest} more` : first
}

export default function AdminDashboard() {
  const { stats, recentActivity, loading } = useAdminStats()
  const navigate = useNavigate()

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label="Total Components"
          value={stats.totalComponents}
          accentClass="border-l-[#0D9488]"
          loading={loading}
          icon={
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
            </svg>
          }
        />
        <StatCard
          label="Total Lockers"
          value={stats.totalLockers}
          accentClass="border-l-blue-400"
          loading={loading}
          icon={
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
          }
        />
        <StatCard
          label="Active Borrows"
          value={stats.activeCount}
          accentClass="border-l-green-400"
          loading={loading}
          icon={
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          }
        />
        <StatCard
          label="Pending Requests"
          value={stats.pendingCount}
          accentClass="border-l-yellow-400"
          pulse
          loading={loading}
          icon={
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
          }
        />
        <StatCard
          label="Overdue Items"
          value={stats.overdueCount}
          accentClass="border-l-red-400"
          pulse
          loading={loading}
          icon={
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          }
        />
        <StatCard
          label="Flagged Students"
          value={stats.flaggedStudents}
          accentClass="border-l-orange-400"
          loading={loading}
          icon={
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
            </svg>
          }
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-800">Recent Activity</h2>
          <Link to="/admin/requests" className="text-sm text-[#0D9488] hover:underline font-medium">
            View All Requests
          </Link>
        </div>
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm divide-y divide-[#E2E8F0]">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))
          ) : recentActivity.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-400">No activity yet</div>
          ) : (
            recentActivity.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate('/admin/requests')}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {item.profiles?.full_name ?? 'Unknown Student'}
                    {item.profiles?.student_id && (
                      <span className="ml-1.5 text-xs font-normal text-slate-400">({item.profiles.student_id})</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{getComponentSummary(item)}</p>
                </div>
                <Badge status={item.status} />
                <span className="text-xs text-slate-400 whitespace-nowrap">{getRelativeTime(item.created_at)}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
