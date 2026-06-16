import { useNotifications } from '../hooks/useNotifications'
import { Button } from '@/shared/components/ui/Button'
import { Skeleton } from '@/shared/components/ui/Skeleton'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { getRelativeTime } from '@/shared/utils/dates'
import { cn } from '@/shared/utils/cn'

export default function NotificationsPage() {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications()

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Notifications</h1>
          <p className="text-sm text-slate-500 mt-1">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={markAllAsRead}>
            Mark all as read
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-[#E2E8F0] p-5 space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          title="No notifications"
          description="You're all caught up. Reminders and system alerts will appear here."
        />
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => (
            <button
              key={notif.id}
              onClick={() => !notif.is_read && markAsRead(notif.id)}
              className={cn(
                'w-full text-left rounded-xl border px-5 py-4 transition-colors',
                notif.is_read
                  ? 'bg-white border-[#E2E8F0]'
                  : 'bg-[#F0FDFA] border-[#0D9488] border-l-4'
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <p className={cn('text-sm font-semibold', notif.is_read ? 'text-slate-700' : 'text-slate-900')}>
                  {notif.title}
                </p>
                <span className="text-xs text-slate-400 whitespace-nowrap flex-shrink-0">
                  {getRelativeTime(notif.created_at)}
                </span>
              </div>
              <p className="text-sm text-slate-600 mt-1 leading-relaxed">{notif.message}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
