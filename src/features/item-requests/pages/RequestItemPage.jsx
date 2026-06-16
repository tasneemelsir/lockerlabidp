import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { useSubmitItemRequest, useMyItemRequests } from '../hooks/useItemRequests'
import { Input } from '@/shared/components/ui/Input'
import { Button } from '@/shared/components/ui/Button'
import { Badge } from '@/shared/components/ui/Badge'
import { Skeleton } from '@/shared/components/ui/Skeleton'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { formatDate } from '@/shared/utils/dates'

const schema = z.object({
  itemName: z.string().min(3, 'Item name must be at least 3 characters'),
  reason: z.string().min(10, 'Please provide at least 10 characters'),
  labName: z.string().min(2, 'Lab name must be at least 2 characters'),
  neededBy: z.string().min(1, 'Please select a date').refine(
    val => new Date(val) > new Date(),
    { message: 'Date must be in the future' }
  ),
})

export default function RequestItemPage() {
  const { submit, loading } = useSubmitItemRequest()
  const { requests, loading: listLoading, refetch } = useMyItemRequests()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema) })

  async function onSubmit(data) {
    try {
      await submit(data.itemName, data.reason, data.labName, data.neededBy)
      toast.success('Request submitted! The lab assistant will review it.')
      reset()
      refetch()
    } catch (err) {
      toast.error(err.message ?? 'Failed to submit. Please try again.')
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Request a New Item</h1>
        <p className="text-sm text-slate-500 mt-1">
          Can&apos;t find what you need? Let us know and we&apos;ll look into adding it.
        </p>
      </div>

      <div className="max-w-lg">
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Item Name"
              placeholder="e.g. Raspberry Pi 4, Arduino Mega"
              error={errors.itemName?.message}
              {...register('itemName')}
            />

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">
                Why do you need this item?
              </label>
              <textarea
                rows={3}
                placeholder="Explain your specific reason for requesting this item..."
                className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0D9488] focus:border-transparent transition resize-none"
                {...register('reason')}
              />
              {errors.reason && (
                <p className="text-xs text-red-500">{errors.reason.message}</p>
              )}
            </div>

            <Input
              label="Which lab is this for?"
              placeholder="e.g. Network Lab, Electronics Lab"
              error={errors.labName?.message}
              {...register('labName')}
            />

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">
                When do you need it by?
              </label>
              <input
                type="date"
                className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#0D9488] focus:border-transparent transition"
                {...register('neededBy')}
              />
              {errors.neededBy && (
                <p className="text-xs text-red-500">{errors.neededBy.message}</p>
              )}
            </div>

            <Button type="submit" variant="primary" size="md" loading={loading} className="w-full">
              Submit Request
            </Button>
          </form>
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold text-slate-800 mb-4">Your Previous Requests</h2>
        {listLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-[#E2E8F0] p-4 flex justify-between items-center">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-6 w-16" />
              </div>
            ))}
          </div>
        ) : requests.length === 0 ? (
          <EmptyState title="No requests yet" description="Submit your first request above." />
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <div
                key={req.id}
                className="bg-white rounded-xl border border-[#E2E8F0] px-5 py-4 flex items-center justify-between gap-4"
              >
                <div>
                  <p className="font-medium text-slate-800">{req.item_name}</p>
                  {req.lab_name && (
                    <p className="text-xs text-slate-500 mt-0.5">{req.lab_name}</p>
                  )}
                  {req.needed_by ? (
                    <p className="text-xs text-slate-400 mt-0.5">
                      Needed by {formatDate(req.needed_by)}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 mt-0.5">{formatDate(req.created_at)}</p>
                  )}
                </div>
                <Badge status={req.status ?? 'pending'} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
