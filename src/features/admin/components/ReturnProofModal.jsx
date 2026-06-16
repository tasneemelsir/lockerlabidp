import { Modal } from '@/shared/components/ui/Modal'
import { Button } from '@/shared/components/ui/Button'
import { formatDate } from '@/shared/utils/dates'

export function ReturnProofModal({ isOpen, onClose, request, onConfirm, onReject, loading }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Return Proof"
      size="md"
    >
      <div className="space-y-4">
        {/* Student info */}
        <div className="flex items-center gap-3 pb-3 border-b border-[#E2E8F0]">
          <div className="w-9 h-9 rounded-full bg-[#0D9488] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {request?.profiles?.full_name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <p className="font-medium text-slate-800">{request?.profiles?.full_name ?? '—'}</p>
            <p className="text-xs text-slate-400">{request?.profiles?.student_id ?? ''}</p>
          </div>
        </div>

        {/* Proof image */}
        {request?.return_image_url ? (
          <button
            type="button"
            onClick={() => window.open(request.return_image_url, '_blank')}
            className="w-full group relative overflow-hidden rounded-xl border border-[#E2E8F0] focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
            title="Click to open full size"
          >
            <img
              src={request.return_image_url}
              alt="Return proof"
              className="w-full object-contain max-h-80 transition-transform group-hover:scale-[1.02]"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
              <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white text-xs px-3 py-1.5 rounded-full font-medium flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                  <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                </svg>
                Open full size
              </span>
            </div>
          </button>
        ) : (
          <div className="w-full h-40 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 text-sm italic">
            No image provided
          </div>
        )}

        {/* Return locker info */}
        {request?.return_locker?.locker_code && (
          <div className="bg-teal-50 border border-teal-200 rounded-lg px-4 py-3">
            <p className="text-sm font-medium text-teal-800">
              Items returned to Locker {request.return_locker.locker_code}
            </p>
            <p className="text-xs text-teal-600 mt-0.5">
              Go to this locker to physically collect the items.
            </p>
          </div>
        )}

        {/* Details */}
        <div className="text-sm text-slate-600 space-y-1">
          {request?.course_name && (
            <p>
              <span className="text-slate-400">Course: </span>
              {request.course_name}
              {request.course_dr_name && ` — ${request.course_dr_name}`}
            </p>
          )}
          {request?.lab_name && (
            <p>
              <span className="text-slate-400">Lab: </span>
              {request.lab_name}
            </p>
          )}
          {(request?.borrow_request_items ?? []).length > 0 && (
            <p>
              <span className="text-slate-400">Items: </span>
              {(request.borrow_request_items ?? []).map(i => i.components?.name).filter(Boolean).join(', ')}
            </p>
          )}
          {request?.lockers?.locker_code && (
            <p>
              <span className="text-slate-400">Locker: </span>
              {request.lockers.locker_code}
            </p>
          )}
          {request?.borrowed_at && (
            <p>
              <span className="text-slate-400">Borrowed: </span>
              {formatDate(request.borrowed_at)}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2 border-t border-[#E2E8F0]">
          <Button type="button" variant="danger" loading={loading} onClick={onReject}>
            Reject Return
          </Button>
          <Button type="button" loading={loading} onClick={onConfirm}>
            Confirm Return
          </Button>
        </div>
      </div>
    </Modal>
  )
}
