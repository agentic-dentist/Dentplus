'use client'

import { useEffect, useRef, useState } from 'react'
import { useClinicUser } from '../clinic-context'

export default function SettingsPage() {
  const { clinicId } = useClinicUser()
  const [slug, setSlug] = useState('')
  const [copied, setCopied] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const hostname = window.location.hostname
    const realSlug = hostname.includes('.dentplus.ca')
      ? hostname.replace('.dentplus.ca', '')
      : 'demo'
    setSlug(realSlug)
  }, [])

  const registerUrl = slug ? `https://${slug}.dentplus.ca/register` : ''

  useEffect(() => {
    if (!registerUrl || !canvasRef.current) return

    import('https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js' as string).then((QRCode: any) => {
      QRCode.toCanvas(canvasRef.current, registerUrl, {
        width: 200,
        margin: 2,
        color: { dark: '#0F172A', light: '#FFFFFF' }
      })
    }).catch(() => {
      // Fallback — use QRServer API
      const img = document.createElement('img')
      img.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(registerUrl)}`
      img.style.width = '200px'
      img.style.height = '200px'
      canvasRef.current?.parentNode?.replaceChild(img, canvasRef.current)
    })
  }, [registerUrl])

  const copyLink = () => {
    navigator.clipboard.writeText(registerUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadQR = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `dentplus-qr-${slug}.png`
    link.href = canvas.toDataURL()
    link.click()
  }

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700&family=DM+Sans:wght@300;400;500&display=swap');`}</style>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 700, color: '#0F172A', marginBottom: 28 }}>Settings</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 900 }}>

        {/* QR Code card */}
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #E2E8F0', padding: 28 }}>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 700, color: '#0F172A', margin: '0 0 4px' }}>Patient registration QR</h2>
          <p style={{ fontSize: 13, color: '#94A3B8', margin: '0 0 24px', lineHeight: 1.5 }}>
            Print and display this at your front desk. Patients scan it to create their account.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: 16, display: 'inline-block' }}>
              <canvas ref={canvasRef} style={{ display: 'block' }} />
            </div>
          </div>

          <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#64748B', wordBreak: 'break-all', flex: 1 }}>{registerUrl}</span>
            <button onClick={copyLink} style={{ background: copied ? '#D1FAE5' : '#EFF6FF', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, color: copied ? '#059669' : '#0EA5E9', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: "'DM Sans', sans-serif" }}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>

          <button onClick={downloadQR} style={{ width: '100%', padding: '10px', background: '#0F172A', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}>
            Download QR code
          </button>
        </div>

        {/* Clinic info card */}
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #E2E8F0', padding: 28 }}>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 700, color: '#0F172A', margin: '0 0 4px' }}>Clinic links</h2>
          <p style={{ fontSize: 13, color: '#94A3B8', margin: '0 0 24px', lineHeight: 1.5 }}>
            Share these links with patients and staff.
          </p>

          {[
            { label: 'Patient portal', url: `https://${slug}.dentplus.ca` },
            { label: 'Book appointment', url: `https://${slug}.dentplus.ca/book` },
            { label: 'Patient registration', url: `https://${slug}.dentplus.ca/register` },
            { label: 'Staff dashboard', url: `https://${slug}.dentplus.ca/dashboard` },
          ].map(item => (
            <div key={item.label} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{item.label}</div>
              <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#475569', wordBreak: 'break-all' }}>{item.url}</span>
                <a href={item.url} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 11, color: '#0EA5E9', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                  Open →
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
