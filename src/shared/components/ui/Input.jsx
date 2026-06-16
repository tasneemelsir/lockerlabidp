import { forwardRef } from 'react'
import { cn } from '@/shared/utils/cn'

export const Input = forwardRef(function Input({ label, error, className, ...rest }, ref) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-slate-700">{label}</label>
      )}
      <input
        ref={ref}
        className={cn(
          'w-full px-3 py-2 rounded-lg border text-sm text-slate-900 bg-white placeholder:text-slate-400',
          'focus:outline-none focus:ring-2 focus:ring-[#0D9488] focus:border-transparent transition',
          error ? 'border-red-400' : 'border-[#E2E8F0]',
          className
        )}
        {...rest}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
})
