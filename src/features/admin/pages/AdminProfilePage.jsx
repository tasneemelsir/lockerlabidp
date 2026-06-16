import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import toast from 'react-hot-toast'
import { useAuth } from '@/shared/context/AuthContext'

export default function AdminProfilePage() {
  const { profile } = useAuth()
  const masterCanvasRef = useRef(null)

  const masterQrData = profile ? JSON.stringify({
    type:             'master',
    admin_id:         profile.id,
    admin_name:       profile.full_name,
    master_qr_token:  profile.master_qr_token,
  }) : ''

  useEffect(() => {
    if (!masterCanvasRef.current || !masterQrData) return
    QRCode.toCanvas(masterCanvasRef.current, masterQrData, {
      width:  220,
      margin: 2,
      color:  { dark: '#0D9488', light: '#ffffff' },
    }).catch(err => console.error('QR error:', err))
  }, [masterQrData])

  function handleDownload() {
    if (!masterCanvasRef.current) { toast.error('QR not ready'); return }
    const link = document.createElement('a')
    link.download = `master-qr-${profile?.student_id ?? 'admin'}.png`
    link.href = masterCanvasRef.current.toDataURL('image/png')
    link.click()
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-slate-500">Loading...</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Admin Profile</h1>
        <p className="text-sm text-slate-500 mt-1">
          Your account information and master locker access QR.
        </p>
      </div>

      {/* Profile Info Card */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-[#0D9488] flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
            {profile.full_name?.[0]?.toUpperCase() ?? 'A'}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-800">{profile.full_name}</h2>
            <p className="text-sm text-slate-500">{profile.email}</p>
            <span className="inline-block mt-1 px-2 py-0.5 bg-[#CCFBF1] text-[#0D9488] text-xs font-semibold rounded-full">
              Lab Assistant
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-0.5">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Staff ID</p>
            <p className="text-sm font-medium text-slate-700">{profile.student_id ?? '—'}</p>
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Email</p>
            <p className="text-sm font-medium text-slate-700">{profile.email ?? '—'}</p>
          </div>
        </div>
      </div>

      {/* Master QR Card */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-800">Master Access QR</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Scan this QR at any locker scanner to enter master mode.
            You can then scan any individual locker QR to open it.
          </p>
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-2">
            <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-xs text-amber-700">
              Keep this QR confidential. It grants access to all lockers.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-5">
          <div className="p-5 bg-white rounded-xl border-2 border-[#E2E8F0]">
            {profile.master_qr_token ? (
              <canvas ref={masterCanvasRef} />
            ) : (
              <div className="w-[220px] h-[220px] bg-slate-100 rounded-lg flex items-center justify-center">
                <p className="text-slate-400 text-xs text-center px-4">
                  Master QR not available. Contact system admin.
                </p>
              </div>
            )}
          </div>

          <div className="text-center space-y-1">
            <p className="text-sm font-semibold text-slate-700">{profile.full_name}</p>
            <p className="text-xs text-slate-500">Lab Assistant • Master Access</p>
            {profile.master_qr_token && (
              <p className="text-xs font-mono text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-[#E2E8F0]">
                Token: {profile.master_qr_token.slice(0, 12)}...
              </p>
            )}
          </div>

          {profile.master_qr_token && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#0D9488] border border-[#0D9488] rounded-lg hover:bg-[#CCFBF1] transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              Download Master QR
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
