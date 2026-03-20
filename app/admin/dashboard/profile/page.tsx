'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ClinicProfile() {
  const [clinicId, setClinicId] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [color, setColor] = useState('#0EA5E9')
  const [welcome, setWelcome] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: owner } = await supabase.from('clinic_owners').select('clinic_id').eq('auth_id', user.id).single()
      if (!owner) return
      setClinicId(owner.clinic_id)

      const { data: clinic } = await supabase.from('clinics').select('name').eq('id', owner.clinic_id).single()
      if (clinic) setName(clinic.name)

      const { data: settings } = await supabase.from('clinic_settings')
        .select('phone, email, address, primary_color, welcome_message')
        .eq('clinic_id', owner.clinic_id).single()
      if (settings) {
        setPhone(settings.phone || '')
        setEmail(settings.email || '')
        setAddress(settings.address || '')
        setColor(settings.primary_color || '#0EA5E9')
        setWelcome(settings.welcome_message || '')
      }
      setLoading(false)
    }
    load()
  }, [])

  const save = async () => {
    setSaving(true)
    await supabase.from('clinics').update({ name }).eq('id', clinicId)
    await supabase.from('clinic_settings').update({
      phone, email, address, primary_color: color, welcome_message: welcome
    }).eq('clinic_id', clinicId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700&display=swap');
        .page-title { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 700; color: #0F172A; margin-bottom: 4px; }
        .page-sub { font-size: 13px; color: #94A3B8; margin-bottom: 28px; }
        .section { background: white; border-radius: 12px; border: 1px solid #E2E8F0; padding: 24px; margin-bottom: 16px; }
        .section-title { font-size: 14px; font-weight: 600; color: #0F172A; margin-bottom: 16px; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .field { margin-bottom: 14px; }
        .field:last-child { margin-bottom: 0; }
        label { display: block; font-size: 12px; font-weight: 500; color: #64748B; margin-bottom: 5px; }
        input, textarea { width: 100%; padding: 10px 14px; border: 1.5px solid #E2E8F0; border-radius: 8px; font-size: 14px; font-family: 'DM Sans', sans-serif; color: #0F172A; outline: none; transition: border-color 0.15s; resize: none; }
        input:focus, textarea:focus { border-color: #0F172A; }
        .color-row { display: flex; align-items: center; gap: 12px; }
        .color-preview { width: 36px; height: 36px; border-radius: 8px; flex-shrink: 0; border: 1px solid #E2E8F0; }
        .color-input { width: 80px !important; padding: 6px 8px !important; }
        .save-btn { padding: 10px 24px; background: #0F172A; color: white; border-radius: 8px; font-size: 14px; font-weight: 500; font-family: 'DM Sans', sans-serif; cursor: pointer; border: none; transition: background 0.15s; }
        .save-btn:hover { background: #1E293B; }
        .save-btn.saved { background: #10B981; }
        .save-btn:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>

      <div className="page-title">Clinic profile</div>
      <div className="page-sub">Update your clinic information and branding</div>

      {loading ? <div style={{ color: '#94A3B8' }}>Loading...</div> : (
        <>
          <div className="section">
            <div className="section-title">Basic information</div>
            <div className="grid-2">
              <div className="field"><label>Clinic name</label><input value={name} onChange={e => setName(e.target.value)} /></div>
              <div className="field"><label>Phone</label><input value={phone} onChange={e => setPhone(e.target.value)} /></div>
              <div className="field"><label>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
              <div className="field"><label>Address</label><input value={address} onChange={e => setAddress(e.target.value)} /></div>
            </div>
          </div>

          <div className="section">
            <div className="section-title">Branding</div>
            <div className="field">
              <label>Primary color</label>
              <div className="color-row">
                <div className="color-preview" style={{ background: color }} />
                <input type="color" value={color} onChange={e => setColor(e.target.value)} className="color-input" />
                <input value={color} onChange={e => setColor(e.target.value)} style={{ flex: 1 }} placeholder="#0EA5E9" />
              </div>
            </div>
          </div>

          <div className="section">
            <div className="section-title">Patient widget</div>
            <div className="field">
              <label>Welcome message</label>
              <textarea rows={3} value={welcome} onChange={e => setWelcome(e.target.value)} placeholder="Welcome! How can we help you today?" />
            </div>
          </div>

          <button className={`save-btn ${saved ? 'saved' : ''}`} onClick={save} disabled={saving}>
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save changes'}
          </button>
        </>
      )}
    </>
  )
}
