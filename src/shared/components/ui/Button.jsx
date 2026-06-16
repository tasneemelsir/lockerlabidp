import { cn } from '@/shared/utils/cn'

const variants = {
  primary: 'bg-[#0D9488] text-white hover:bg-[#0F766E] disabled:opacity-50',
  secondary: 'bg-white text-slate-700 border border-[#E2E8F0] hover:bg-[#F8FAFC] disabled:opacity-50',
  danger: 'bg-red-500 text-white hover:bg-red-600 disabled:opacity-50',
  ghost: 'text-[#0D9488] hover:bg-[#CCFBF1] disabled:opacity-50',
}

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
}

const Spinner = () => (
  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
  </svg>
)

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  onClick,
  type = 'button',
  children,
  className,
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors cursor-pointer',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {loading && <Spinner />}
      {children}
    </button>
  )
}
