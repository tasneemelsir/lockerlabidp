import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import toast from 'react-hot-toast'
import { Modal } from '@/shared/components/ui/Modal'
import { formatDate } from '@/shared/utils/dates'

export function LockerQRModal({ isOpen, onClose, request }) {
  const canvasRef = useRef(null)

  const lockerCode = request?.lockers?.locker_code ?? null

  const qrData = request?.qr_token
    ? JSON.stringify({
        request_id:   request.id,
        student_id:   request.student_id,
        locker:       lockerCode ?? 'Unassigned',
        locker_id:    request.assigned_locker_id,
        qr_token:     request.qr_token,
        due_date:     request.due_date,
        components:   (request.borrow_request_items ?? []).map(item => ({
          name:     item.components?.name,
          quantity: item.quantity_requested,
        })),
      })
    : null

  useEffect(() => {
    if (!isOpen || !canvasRef.current || !qrData) return
    QRCode.toCanvas(canvasRef.current, qrData, {
      width: 220,
      margin: 2,
      color: { dark: '#0D9488', light: '#ffffff' },
    }).catch(err => console.error('QR error:', err))
  }, [isOpen, qrData])

  function handleDownload() {
    if (!canvasRef.current) { toast.error('QR not ready'); return }
    const link = document.createElement('a')
    link.download = `locker-qr-${request?.id?.slice(0, 8) ?? 'borrow'}.png`
    link.href = canvasRef.current.toDataURL('image/png')
    link.click()
  }

  const items = request?.borrow_request_items ?? []

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Locker Access QR" size="sm">
      {!request?.qr_token ? (
        <div className="text-center py-8 text-sm text-slate-500">
          QR not available yet. Please wait for admin approval.
        </div>
      ) : !lockerCode ? (
        <div className="text-center py-8 text-sm text-amber-600">
          No locker assigned to this request. Contact the lab assistant.
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 py-2">
          <p className="text-sm text-slate-600 text-center">
            Scan this QR at Locker <strong className="text-[#0D9488]">{lockerCode}</strong> to collect your items.
          </p>

          <div className="p-4 bg-white rounded-xl border-2 border-[#E2E8F0]">
            <canvas ref={canvasRef} />
          </div>

          {/* Locker code prominent display */}
          <div className="text-center">
            <p className="text-2xl font-bold text-[#0D9488]">{lockerCode}</p>
            <p className="text-xs text-slate-400 mt-0.5">Assigned Locker</p>
          </div>

          {/* Component list */}
          {items.length > 0 && (
            <div className="w-full bg-slate-50 rounded-lg border border-[#E2E8F0] px-3 py-2">
              <p className="text-xs font-semibold text-slate-500 mb-1.5">Items in this request</p>
              <ul className="space-y-1">
                {items.map(item => (
                  <li key={item.id} className="flex items-center justify-between text-xs text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#0D9488] flex-shrink-0" />
                      {item.components?.name ?? 'Unknown'}
                    </span>
                    <span className="text-slate-400">×{item.quantity_requested}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {request.due_date && (
            <p className="text-sm text-slate-500">Due: <strong>{formatDate(request.due_date)}</strong></p>
          )}

          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#0D9488] border border-[#0D9488] rounded-lg hover:bg-[#CCFBF1] transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Download QR
          </button>
        </div>
      )}
    </Modal>
  )
}
