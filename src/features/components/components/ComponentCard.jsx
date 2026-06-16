import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useCart } from '@/features/borrows/context/CartContext'
import { cn } from '@/shared/utils/cn'

export function ComponentCard({ component }) {
  const navigate = useNavigate()
  const { cartItems, cartCount, addToCart } = useCart()
  const available = component.quantity_available > 0
  const inCart = cartItems.some(item => item.component.id === component.id)

  function handleAddToCart(e) {
    e.stopPropagation()
    if (cartCount >= 5 && !inCart) {
      toast.error('Cart is full (max 5 components)')
      return
    }
    const added = addToCart(component, 1)
    if (added) toast.success('Added to cart')
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full capitalize">
          {component.category}
        </span>
        <div className="flex items-center gap-1.5">
          <span className={cn('w-2 h-2 rounded-full', available ? 'bg-green-500' : 'bg-red-400')} />
          <span className={cn('text-xs font-medium', available ? 'text-green-700' : 'text-red-600')}>
            {available ? 'Available' : 'Unavailable'}
          </span>
        </div>
      </div>

      <div className="flex-1">
        <h3 className="font-semibold text-slate-800 leading-snug">{component.name}</h3>
        {component.description && (
          <p className="text-sm text-slate-500 mt-1 line-clamp-2">{component.description}</p>
        )}
        {component.lab_name && (
          <p className="text-xs text-slate-400 mt-1 truncate max-w-full">{component.lab_name}</p>
        )}
      </div>

      <div className="flex items-center justify-end text-xs text-slate-500">
        <span className="font-medium text-slate-700">{component.quantity_available} left</span>
      </div>

      {inCart ? (
        <button
          type="button"
          disabled
          className="w-full py-2 px-4 rounded-lg text-sm font-medium bg-[#0D9488] text-white opacity-80 cursor-not-allowed flex items-center justify-center gap-1.5"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          In Cart
        </button>
      ) : !available ? (
        <button
          type="button"
          disabled
          className="w-full py-2 px-4 rounded-lg text-sm font-medium bg-slate-100 text-slate-400 cursor-not-allowed"
        >
          Unavailable
        </button>
      ) : (
        <button
          type="button"
          onClick={handleAddToCart}
          className="w-full py-2 px-4 rounded-lg text-sm font-medium bg-[#0D9488] text-white hover:bg-[#0B7A70] transition-colors flex items-center justify-center gap-1.5"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
          </svg>
          Add to Cart
        </button>
      )}
    </div>
  )
}
