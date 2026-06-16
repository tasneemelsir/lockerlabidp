import { cn } from '@/shared/utils/cn'

export function Skeleton({ className }) {
  return (
    <div className={cn('animate-pulse rounded-md bg-slate-200', className)} />
  )
}
