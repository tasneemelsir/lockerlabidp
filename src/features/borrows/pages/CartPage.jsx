import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useCart } from '../context/CartContext'
import { supabase } from '@/shared/lib/supabase'
import { Button } from '@/shared/components/ui/Button'
import { Input } from '@/shared/components/ui/Input'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { cn } from '@/shared/utils/cn'

const schema = z.object({
  course_name: z.string().min(2, 'Course name must be at least 2 characters'),
  course_dr_name: z.string().min(2, 'Doctor name must be at least 2 characters'),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
  pickup_date: z.string().refine(val => new Date(val) > new Date(), {
    message: 'Pickup date must be in the future',
  }),
  requested_days: z.coerce.number().int().min(1, 'Minimum 1 day').max(30, 'Maximum 30 days'),
})

function formatDueDate(pickupDate, days) {
  if (!pickupDate || !days || days < 1) return null
  const d = new Date(pickupDate)
  if (isNaN(d.getTime())) return null
  d.setDate(d.getDate() + Number(days))
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function CartPage() {
  const navigate = useNavigate()
  const { cartItems, cartCount, removeFromCart, updateQuantity, clearCart } = useCart()
  const [submitting, setSubmitting] = useState(false)

  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { course_name: '', course_dr_name: '', reason: '', pickup_date: '', requested_days: 7 },
  })

  const watchedPickup = watch('pickup_date')
  const watchedDays = watch('requested_days')
  const dueDate = formatDueDate(watchedPickup, watchedDays)

  async function onSubmit(data) {
    if (cartCount === 0) {
      toast.error('Your cart is empty')
      return
    }
    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: requestData, error: reqErr } = await supabase
        .from('borrow_requests')
        .insert({
          student_id: user.id,
          status: 'pending',
          course_name: data.course_name,
          course_dr_name: data.course_dr_name,
          reason: data.reason,
          pickup_date: data.pickup_date,
          requested_days: data.requested_days,
          quantity_requested: cartItems.reduce((sum, i) => sum + i.quantity, 0),
        })
        .select()
        .single()
      if (reqErr) throw reqErr

      const { error: itemsErr } = await supabase.from('borrow_request_items').insert(
        cartItems.map(item => ({
          borrow_request_id: requestData.id,
          component_id: item.component.id,
          quantity_requested: item.quantity,
        }))
      )
      if (itemsErr) throw itemsErr

      clearCart()
      toast.success('Request submitted successfully!')
      navigate('/my-requests')
    } catch (err) {
      toast.error(err.message ?? 'Failed to submit request')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Cart</h1>
        <p className="text-sm text-slate-500 mt-1">Review your components and fill in request details.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Left column — Cart Items */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">
              Your Cart
              <span className="ml-2 text-sm font-normal text-slate-500">({cartCount} item{cartCount !== 1 ? 's' : ''})</span>
            </h2>
          </div>

          {cartCount === 5 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-sm text-yellow-700 font-medium">
              Cart is full — maximum 5 components per request.
            </div>
          )}

          {cartCount < 5 && (
            <p className="text-xs text-slate-400">You can add up to 5 components per request.</p>
          )}

          {cartCount === 0 ? (
            <EmptyState
              title="Your cart is empty"
              description="Browse components and add them to your cart."
              action={{ label: 'Browse Components', onClick: () => navigate('/components') }}
            />
          ) : (
            <div className="space-y-3">
              {cartItems.map(({ component, quantity }) => (
                <div key={component.id} className="bg-white rounded-xl border border-[#E2E8F0] p-4 flex flex-col gap-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 leading-snug">{component.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full capitalize">
                          {component.category}
                        </span>
                        {component.lockers?.locker_code && (
                          <span className="text-xs text-slate-400">{component.lockers.locker_code}</span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromCart(component.id)}
                      className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors flex-shrink-0"
                      aria-label="Remove from cart"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>

                  {/* Quantity stepper */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">Qty:</span>
                    <div className="flex items-center border border-[#E2E8F0] rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => updateQuantity(component.id, Math.max(1, quantity - 1))}
                        className="px-3 py-1.5 text-slate-600 hover:bg-slate-50 transition-colors text-sm font-medium"
                        disabled={quantity <= 1}
                      >
                        −
                      </button>
                      <span className="px-4 py-1.5 text-sm font-medium text-slate-800 border-x border-[#E2E8F0] min-w-[2.5rem] text-center">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(component.id, Math.min(component.quantity_available, quantity + 1))}
                        className="px-3 py-1.5 text-slate-600 hover:bg-slate-50 transition-colors text-sm font-medium"
                        disabled={quantity >= component.quantity_available}
                      >
                        +
                      </button>
                    </div>
                    <span className="text-xs text-slate-400">(max {component.quantity_available})</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column — Request Details Form */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800 mb-5">Request Details</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Course Name"
              placeholder="e.g. BEE 3223 Power Electronics"
              error={errors.course_name?.message}
              {...register('course_name')}
            />
            <Input
              label="Course Dr Name"
              placeholder="e.g. Dr. Ahmad bin Abdullah"
              error={errors.course_dr_name?.message}
              {...register('course_dr_name')}
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Reason</label>
              <textarea
                {...register('reason')}
                rows={4}
                placeholder="Describe why you need these components..."
                className={cn(
                  'w-full px-3 py-2 rounded-lg border text-sm text-slate-900 bg-white resize-none h-24',
                  'focus:outline-none focus:ring-2 focus:ring-[#0D9488] focus:border-transparent transition',
                  errors.reason ? 'border-red-400' : 'border-[#E2E8F0]'
                )}
              />
              {errors.reason && <p className="text-xs text-red-500">{errors.reason.message}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Preferred Pickup Date</label>
              <input
                type="date"
                {...register('pickup_date')}
                min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                className={cn(
                  'w-full px-3 py-2 rounded-lg border text-sm text-slate-900 bg-white',
                  'focus:outline-none focus:ring-2 focus:ring-[#0D9488] focus:border-transparent transition',
                  errors.pickup_date ? 'border-red-400' : 'border-[#E2E8F0]'
                )}
              />
              {errors.pickup_date && <p className="text-xs text-red-500">{errors.pickup_date.message}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">How many days do you need it?</label>
              <input
                type="number"
                min={1}
                max={30}
                {...register('requested_days')}
                className={cn(
                  'w-full px-3 py-2 rounded-lg border text-sm text-slate-900 bg-white',
                  'focus:outline-none focus:ring-2 focus:ring-[#0D9488] focus:border-transparent transition',
                  errors.requested_days ? 'border-red-400' : 'border-[#E2E8F0]'
                )}
              />
              {errors.requested_days && <p className="text-xs text-red-500">{errors.requested_days.message}</p>}
              {dueDate && (
                <p className="text-xs text-slate-500 mt-0.5">Due date will be: <strong>{dueDate}</strong></p>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              loading={submitting}
              disabled={cartCount === 0}
            >
              Submit Request
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
