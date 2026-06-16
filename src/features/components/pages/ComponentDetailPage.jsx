import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useComponentDetail } from '../hooks/useComponents'
import { useCart } from '@/features/borrows/context/CartContext'
import { Badge } from '@/shared/components/ui/Badge'
import { Button } from '@/shared/components/ui/Button'
import { Skeleton } from '@/shared/components/ui/Skeleton'

function PlaceholderImage() {
  return (
    <div className="w-full h-64 bg-[#F0FDFA] rounded-xl flex items-center justify-center">
      <svg className="w-24 h-24 text-[#0D9488] opacity-30" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="8" y="8" width="48" height="48" rx="6" />
        <circle cx="32" cy="28" r="8" />
        <path d="M14 52c0-10 8-16 18-16s18 6 18 16" strokeLinecap="round" />
      </svg>
    </div>
  )
}

export default function ComponentDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { component, loading, error } = useComponentDetail(id)
  const { cartItems, cartCount, addToCart } = useCart()

  const inCart = cartItems.some(item => item.component.id === id)

  function handleAddToCart() {
    if (cartCount >= 5 && !inCart) {
      toast.error('Cart is full (max 5 components)')
      return
    }
    const added = addToCart(component, 1)
    if (added) {
      toast.success('Added to cart')
      navigate('/cart')
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Skeleton className="h-64 rounded-xl" />
          <div className="space-y-4">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !component) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3">
        {error ?? 'Component not found.'}
      </div>
    )
  }

  const unavailable = component.quantity_available === 0

  return (
    <div>
      <button
        onClick={() => navigate('/components')}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#0D9488] mb-6 transition-colors"
      >
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        Back to Components
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          {component.image_url ? (
            <img
              src={component.image_url}
              alt={component.name}
              className="w-full h-64 object-cover rounded-xl border border-[#E2E8F0]"
            />
          ) : (
            <PlaceholderImage />
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full capitalize">
              {component.category}
            </span>
            {unavailable && <Badge status="returned" className="!bg-red-100 !text-red-600">Out of Stock</Badge>}
          </div>

          <h1 className="text-2xl font-bold text-slate-800">{component.name}</h1>

          {component.description && (
            <p className="text-slate-600 text-sm leading-relaxed">{component.description}</p>
          )}

          <div className="flex items-center gap-2 text-sm">
            <svg className="w-4 h-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
              <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
            </svg>
            <span className="text-slate-600">
              <span className="font-semibold text-slate-800">{component.quantity_available}</span>
              {' '}of{' '}
              <span className="font-semibold text-slate-800">{component.quantity_total}</span>
              {' '}available
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <svg className="w-4 h-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            <span className="text-slate-600">
              <span className="font-semibold text-slate-800">Lab:</span>{' '}
              {component.lab_name ?? 'General Use'}
            </span>
          </div>

          <div className="pt-2 border-t border-[#E2E8F0]">
            {inCart ? (
              <div className="space-y-3">
                <div className="bg-[#F0FDFA] border border-[#CCFBF1] rounded-lg px-4 py-3 text-sm text-[#0D9488] font-medium flex items-center gap-2">
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  This component is in your cart
                </div>
                <Button variant="secondary" size="lg" className="w-full" onClick={() => navigate('/cart')}>
                  View Cart
                </Button>
              </div>
            ) : unavailable ? (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                This component is currently unavailable. Check back later.
              </div>
            ) : (
              <Button
                type="button"
                variant="primary"
                size="lg"
                className="w-full"
                onClick={handleAddToCart}
                disabled={cartCount >= 5}
              >
                <svg className="w-4 h-4 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
                </svg>
                {cartCount >= 5 ? 'Cart Full' : 'Add to Cart'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
