import { useState, useRef, useEffect, useCallback } from 'react'
import QRCode from 'qrcode'
import toast from 'react-hot-toast'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { Modal } from '@/shared/components/ui/Modal'
import { Button } from '@/shared/components/ui/Button'
import { initReturnRequest, pollQrScanned, submitReturnProof } from '../hooks/useBorrows'
import { cn } from '@/shared/utils/cn'

export function ReturnRequestModal({ isOpen, onClose, request, onSuccess }) {
  const [step,          setStep]          = useState(1)
  const [returnLocker,  setReturnLocker]  = useState(null)
  const [returnQrToken, setReturnQrToken] = useState(null)
  const [qrScanned,     setQrScanned]     = useState(false)
  const [polling,       setPolling]       = useState(false)
  const [selectedFile,  setSelectedFile]  = useState(null)
  const [fileReady,     setFileReady]     = useState(false)
  const [fileError,     setFileError]     = useState('')
  const [loading,       setLoading]       = useState(false)
  const [initLoading,   setInitLoading]   = useState(false)
  const [initError,     setInitError]     = useState('')
  const [dragOver,      setDragOver]      = useState(false)
  const [preview,       setPreview]       = useState(null)

  const pollIntervalRef    = useRef(null)
  const abortControllerRef = useRef(null)
  const canvasRef          = useRef(null)
  const isMountedRef       = useRef(true)
  const fileInputRef       = useRef(null)
  // Keeps the latest step available inside the native back-button listener
  // without forcing the listener to re-register on every step change.
  const stepRef            = useRef(step)

  useEffect(() => { stepRef.current = step }, [step])

  const stopPolling = useCallback(() => {
    setPolling(false)
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
  }, [])

  const startPolling = useCallback(() => {
    if (!request) return
    setPolling(true)
    pollIntervalRef.current = setInterval(async () => {
      if (!isMountedRef.current) return
      try {
        const scanned = await pollQrScanned(request.id)
        if (scanned && isMountedRef.current) {
          stopPolling()
          setQrScanned(true)
          setStep(2)
        }
      } catch {
        // ignore poll errors silently
      }
    }, 3000)
  }, [request, stopPolling])

  const handleInit = useCallback(async () => {
    if (!request) return
    setInitLoading(true)
    setInitError('')
    try {
      const result = await initReturnRequest(request.id, request.student_id)
      if (!isMountedRef.current) return
      setReturnLocker(result.returnLocker)
      setReturnQrToken(result.returnQrToken)
      startPolling()
    } catch (err) {
      if (!isMountedRef.current) return
      setInitError(err.message)
    } finally {
      if (isMountedRef.current) setInitLoading(false)
    }
  }, [request, startPolling])

  // Init on open, cleanup on close/unmount
  useEffect(() => {
    isMountedRef.current = true
    if (isOpen) {
      handleInit()
    }
    return () => {
      isMountedRef.current = false
      stopPolling()
      abortControllerRef.current?.abort()
    }
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset all state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStep(1)
      setReturnLocker(null)
      setReturnQrToken(null)
      setQrScanned(false)
      setSelectedFile(null)
      setFileReady(false)
      setFileError('')
      setInitError('')
      setLoading(false)
      setInitLoading(false)
      setDragOver(false)
      setPreview(null)
      stopPolling()
    }
  }, [isOpen, stopPolling])

  // Generate QR once we have the locker + token (step 1 only)
  useEffect(() => {
    if (step !== 1 || !canvasRef.current || !returnLocker || !returnQrToken || !request) return
    const qrData = JSON.stringify({
      type:            'return',
      request_id:      request.id,
      student_id:      request.student_id,
      locker:          returnLocker.locker_code,
      locker_id:       returnLocker.id,
      return_qr_token: returnQrToken,
      components:      (request.borrow_request_items ?? []).map(i => i.components?.name).filter(Boolean),
    })
    QRCode.toCanvas(canvasRef.current, qrData, {
      width:  220,
      margin: 2,
      color:  { dark: '#0D9488', light: '#ffffff' },
    }).catch(err => console.error('QR error:', err))
  }, [returnLocker, returnQrToken, step, request])

  // ── Native hardware back / swipe-back gesture ──
  // While the modal is open, the Android back gesture should:
  //   - on step 2  → go back to step 1 (don't lose the locker/token)
  //   - on step 1  → close the modal
  // It must NOT pop the route or background the app.
  useEffect(() => {
    if (!isOpen || !Capacitor.isNativePlatform()) return
    let listener
    // Tell the global back handler to stand down while the modal owns "back".
    window.__modalBackActive = true
    App.addListener('backButton', () => {
      if (stepRef.current === 2) {
        setStep(1)
      } else {
        onClose()
      }
    }).then(l => { listener = l })
    return () => {
      window.__modalBackActive = false
      listener?.remove()
    }
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Native image picker (Android/iOS) ──
  // Uses @capacitor/camera so the OS returns a lightweight webPath instead of a
  // full-resolution base64 blob, and restores its pending call across activity
  // recreation. This is what stops the WebView from reloading on photo pick.
  async function pickImage() {
    setFileError('')
    try {
      const photo = await Camera.getPhoto({
        source:             CameraSource.Prompt,   // let user choose camera or gallery
        resultType:         CameraResultType.Uri,  // webPath, NOT base64 → low memory
        quality:            70,
        width:              1280,                   // downscale natively before JS sees it
        correctOrientation: true,
        promptLabelHeader:  'Return Photo',
        promptLabelPhoto:   'Choose from Gallery',
        promptLabelPicture: 'Take Photo',
        promptLabelCancel:  'Cancel',
      })

      // Turn the webPath into a real File for the Supabase upload.
      const res  = await fetch(photo.webPath)
      const blob = await res.blob()

      if (blob.size > 15 * 1024 * 1024) {
  setFileError('Image must be smaller than 15MB')
  return
}

      const file = new File([blob], `return-${Date.now()}.jpg`, {
        type: blob.type || 'image/jpeg',
      })

      setSelectedFile(file)
      setFileReady(true)
      setPreview(photo.webPath)   // webPath is directly usable as an <img src>
    } catch (err) {
      // The user tapping "cancel" rejects the promise — treat it as a no-op.
      const msg = (err?.message || '').toLowerCase()
      if (msg.includes('cancel')) return
      setFileError('Could not load image. Please try again.')
    }
  }

  // Dispatcher: native → plugin, web/desktop → hidden file input.
  function handleUploadClick() {
    if (Capacitor.isNativePlatform()) {
      pickImage()
    } else {
      fileInputRef.current?.click()
    }
  }

  // Web/desktop fallback (also used by drag-and-drop).
  function handleFileChange(e) {
    const file = e.target.files?.[0]
    setSelectedFile(null)
    setFileReady(false)
    setFileError('')
    setPreview(null)
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
      setFileError('Only JPEG and PNG images are allowed')
      return
    }
    if (file.size > 15 * 1024 * 1024) {
  setFileError('Image must be smaller than 15MB')
  return
}
    setSelectedFile(file)
    setFileReady(true)
    const reader = new FileReader()
    reader.onload = ev => setPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFileChange({ target: { files: [file] } })
    }
  }

  function handleDownload() {
    if (!canvasRef.current) return
    const link = document.createElement('a')
    link.download = `return-qr-${request?.id?.slice(0, 8) ?? 'return'}.png`
    link.href = canvasRef.current.toDataURL('image/png')
    link.click()
  }

  async function handleSubmitProof() {
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal
    try {
      setLoading(true)
      await submitReturnProof(request.id, request.student_id, selectedFile, signal)
      if (!signal.aborted && isMountedRef.current) {
        toast.success('Return request submitted. Awaiting admin review.')
        onSuccess?.()
        onClose()
      }
    } catch (err) {
      if (!signal.aborted && isMountedRef.current) {
        toast.error(err.message)
      }
    } finally {
      if (!signal.aborted && isMountedRef.current) {
        setLoading(false)
      }
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={step === 1 ? 'Return Item — Step 1 of 2' : 'Return Item — Step 2 of 2'}
      size="md"
    >
      {/* ── Step 1: QR Code ── */}
      {step === 1 && (
        <div className="flex flex-col items-center gap-5 py-2">
          {initLoading && (
            <div className="flex flex-col items-center gap-3 py-8 text-slate-500">
              <svg className="w-8 h-8 animate-spin text-[#0D9488]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <p className="text-sm">Finding available locker...</p>
            </div>
          )}

          {!initLoading && initError && (
            <div className="w-full space-y-3">
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {initError}
              </div>
              <div className="flex justify-center">
                <Button type="button" onClick={handleInit}>Retry</Button>
              </div>
            </div>
          )}

          {!initLoading && !initError && returnLocker && returnQrToken && (
            <>
              <div className="w-full bg-teal-50 border border-teal-200 rounded-lg px-4 py-3 text-center">
                <p className="text-sm font-semibold text-teal-800">
                  Scan this QR at Locker{' '}
                  <span className="font-bold">{returnLocker.locker_code}</span>{' '}
                  to open it, place your items inside, then close the door.
                </p>
              </div>

              <div className="p-4 bg-white rounded-xl border-2 border-[#E2E8F0]">
                <canvas ref={canvasRef} />
              </div>

              {(request?.borrow_request_items ?? []).length > 0 && (
                <div className="text-xs text-slate-500 space-y-0.5 text-center">
                  {(request.borrow_request_items ?? []).map(item => (
                    <p key={item.id}>{item.components?.name} ×{item.quantity_requested}</p>
                  ))}
                </div>
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

              {!qrScanned ? (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse flex-shrink-0" />
                  Waiting for locker scan...
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <span className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
                  Locker opened! Proceeding to upload...
                </div>
              )}

              <div className="w-full pt-2 border-t border-[#E2E8F0]">
                <Button
                  type="button"
                  className="w-full"
                  disabled={!qrScanned}
                  onClick={() => setStep(2)}
                >
                  Next: Upload Proof
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Step 2: Image Upload ── */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Take a photo of the items inside Locker{' '}
            <strong className="text-[#0D9488]">{returnLocker?.locker_code}</strong>{' '}
            and upload it.
          </p>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">
              Return Photo <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-slate-500">A photo is required to process your return.</p>
          </div>

          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={handleUploadClick}
            className={cn(
              'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors',
              dragOver
                ? 'border-[#0D9488] bg-[#F0FDFA]'
                : 'border-[#E2E8F0] hover:border-[#0D9488] hover:bg-slate-50'
            )}
          >
            {fileReady && preview ? (
              <img src={preview} alt="Return proof preview" className="max-h-48 mx-auto rounded-lg object-contain" />
            ) : (
              <div className="space-y-2 py-2">
                <svg className="w-10 h-10 text-slate-300 mx-auto" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                </svg>
                <p className="text-sm font-medium text-slate-600">Tap to take a photo or choose from gallery</p>
                <p className="text-xs text-slate-400">JPEG or PNG, max 5MB</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/jpg"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {fileError && <p className="text-xs text-red-500">{fileError}</p>}

          {fileReady && preview && (
            <button
              type="button"
              className="text-xs text-slate-400 hover:text-slate-600 underline"
              onClick={() => { setSelectedFile(null); setPreview(null); setFileReady(false) }}
            >
              Remove image
            </button>
          )}

          <div className="flex justify-between gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button
              type="button"
              loading={loading}
              disabled={!fileReady || loading}
              onClick={handleSubmitProof}
            >
              Submit Return Request
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}