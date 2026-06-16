import { forwardRef } from 'react'
import { cn } from '@/shared/utils/cn'

export const Select = forwardRef(function Select({ label, error, options = [], className, ...rest }, ref) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-slate-700">{label}</label>
      )}
      <select
        ref={ref}
        className={cn(
          'w-full px-3 py-2 rounded-lg border text-sm text-slate-900 bg-white',
          'focus:outline-none focus:ring-2 focus:ring-[#0D9488] focus:border-transparent transition',
          error ? 'border-red-400' : 'border-[#E2E8F0]',
          className
        )}
        {...rest}
      >
        {options.map((opt) => (
          <option
            key={opt.value}
            value={opt.value}
            disabled={opt.disabled}
            className={opt.disabled ? 'text-gray-400' : ''}
          >
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
})
