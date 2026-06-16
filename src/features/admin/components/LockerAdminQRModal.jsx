import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import toast from 'react-hot-toast'

export default function LockerAdminQRModal({ isOpen, onClose, locker }) {
  const canvasRef = useRef(null)

  const qrData = locker ? JSON.stringify({
    type:        'locker_select',
    locker_id:   locker.id,
    locker_code: locker.locker_code,
  }) : ''

  useEffect(() => {
    if (!isOpen || !canvasRef.current || !qrData) return
    QRCode.toCanvas(canvasRef.current, qrData, {
      width:  220,
      margin: 2,
      color:  { dark: '#0D9488', light: '#ffffff' },
    }).catch(err => console.error('QR error:', err))
  }, [isOpen, qrData])

  function handleDownload() {
    if (!canvasRef.current) { toast.error('QR not ready'); return }
    const link = document.createElement('a')
    link.download = `locker-${locker?.locker_code ?? 'qr'}.png`
    link.href = canvasRef.current.toDataURL('image/png')
    link.click()
  }

  if (!isOpen || !locker) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800">
            Locker {locker.locker_code} QR
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <p className="text-sm text-slate-500 mb-4">
          Scan master QR first, then scan this to open Locker {locker.locker_code}.
        </p>

        <div className="flex flex-col items-center gap-4">
          <div className="p-4 border-2 border-[#E2E8F0] rounded-xl">
            <canvas ref={canvasRef} />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-700">Locker {locker.locker_code}</p>
            {locker.description && (
              <p className="text-xs text-slate-400 mt-0.5">{locker.description}</p>
            )}
          </div>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#0D9488] border border-[#0D9488] rounded-lg hover:bg-[#CCFBF1] transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Download
          </button>
        </div>
      </div>
    </div>
  )
}
