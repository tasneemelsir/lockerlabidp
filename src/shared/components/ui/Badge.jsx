import { cn } from '@/shared/utils/cn'

const statusMap = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  returned: 'bg-gray-100 text-gray-600',
  overdue: 'bg-red-100 text-red-700',
  resolved: 'bg-teal-100 text-teal-700',
}

export function Badge({ status, className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize',
        statusMap[status] ?? 'bg-gray-100 text-gray-600',
        className
      )}
    >
      {status}
    </span>
  )
}
