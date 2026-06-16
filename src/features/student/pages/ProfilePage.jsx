import { useAuth } from '@/shared/context/AuthContext'
import { useState, useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import toast from 'react-hot-toast'

function InfoRow({ label, value, valueClass }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</p>
      <p className={`text-sm font-medium text-slate-700 ${valueClass ?? ''}`}>{value}</p>
    </div>
  )
}

export default function ProfilePage() {
  const { profile } = useAuth()
  const canvasRef = useRef(null)

  const qrData = profile
    ? JSON.stringify({
        id: profile.id,
        name: profile.full_name,
        studentId: profile.student_id,
        email: profile.email,
        token: profile.qr_token,
      })
    : ''

  useEffect(() => {
    if (!canvasRef.current || !qrData) return
    QRCode.toCanvas(canvasRef.current, qrData, {
      width: 220,
      margin: 2,
      color: {
        dark: '#0D9488',
        light: '#ffffff',
      },
    }).catch(err => console.error('QR generation error:', err))
  }, [qrData])

  function handleDownloadQR() {
    if (!canvasRef.current) { toast.error('QR code not ready'); return }
    const link = document.createElement('a')
    link.download = `qr-${profile?.student_id ?? 'student'}.png`
    link.href = canvasRef.current.toDataURL('image/png')
    link.click()
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-slate-500">Loading profile...</p>
      </div>
    )
  }

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">My Profile</h1>
        <p className="text-sm text-slate-500 mt-1">
          Your personal information and unique QR code for lab access.
        </p>
      </div>

      {/* Profile Info */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-[#0D9488] flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
            {profile.full_name?.[0]?.toUpperCase() ?? 'S'}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-800">{profile.full_name}</h2>
            <p className="text-sm text-slate-500">{profile.email}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InfoRow label="Student ID" value={profile.student_id ?? '—'} />
          <InfoRow label="Role" value={profile.role ?? 'student'} />
          <InfoRow
            label="Account Status"
            value={profile.is_flagged ? 'Flagged' : 'Active'}
            valueClass={profile.is_flagged ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}
          />
          <InfoRow label="Email" value={profile.email ?? '—'} />
        </div>
      </div>

      {/* QR Code */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-slate-800">Your QR Code</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Show this at the locker scanner to verify your identity and open your assigned locker.
          </p>
        </div>

        <div className="flex flex-col items-center gap-5">
          <div className="p-5 bg-white rounded-xl border-2 border-[#E2E8F0]">
            {profile.qr_token ? (
              <canvas ref={canvasRef} />
            ) : (
              <div className="w-[220px] h-[220px] bg-slate-100 rounded-lg flex flex-col items-center justify-center gap-2">
                <svg className="w-10 h-10 text-slate-300" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm2 2V5h1v1H5zM3 13a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3zm2 2v-1h1v1H5zM13 3a1 1 0 00-1 1v3a1 1 0 001 1h3a1 1 0 001-1V4a1 1 0 00-1-1h-3zm1 2v1h1V5h-1z" clipRule="evenodd" />
                </svg>
                <p className="text-slate-400 text-xs text-center px-4">
                  QR code not available. Please contact admin.
                </p>
              </div>
            )}
          </div>

          <div className="text-center space-y-1">
            <p className="text-sm font-semibold text-slate-700">{profile.full_name}</p>
            <p className="text-xs text-slate-500">{profile.student_id}</p>
            {profile.qr_token && (
              <p className="text-xs font-mono text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-[#E2E8F0]">
                ID: {profile.qr_token.slice(0, 12)}...
              </p>
            )}
          </div>

          {profile.qr_token && (
            <button
              type="button"
              onClick={handleDownloadQR}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#0D9488] border border-[#0D9488] rounded-lg hover:bg-[#CCFBF1] transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              Download QR Code
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
