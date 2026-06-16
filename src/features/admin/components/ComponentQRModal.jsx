import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import toast from 'react-hot-toast'
import { Modal } from '@/shared/components/ui/Modal'

export function ComponentQRModal({ isOpen, onClose, component }) {
  const canvasRef = useRef(null)

  const qrData = component
    ? JSON.stringify({
        component_id: component.id,
        name: component.name,
        category: component.category,
        locker: component.lockers?.locker_code,
        quantity_total: component.quantity_total,
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
    link.download = `component-qr-${component?.name?.replace(/\s+/g, '-').toLowerCase() ?? 'component'}.png`
    link.href = canvasRef.current.toDataURL('image/png')
    link.click()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Component QR Code" size="sm">
      <div className="flex flex-col items-center gap-5 py-2">
        <div className="p-4 bg-white rounded-xl border-2 border-[#E2E8F0]">
          <canvas ref={canvasRef} />
        </div>
        <div className="text-center space-y-1">
          <p className="font-semibold text-slate-800">{component?.name}</p>
          {component?.category && (
            <p className="text-sm text-slate-500">{component.category}</p>
          )}
          {component?.lockers?.locker_code && (
            <p className="text-sm text-slate-500">Locker: {component.lockers.locker_code}</p>
          )}
        </div>
        <p className="text-xs text-slate-400 text-center px-4 leading-relaxed">
          Scan to identify this component and its locker location.
        </p>
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
    </Modal>
  )
}
