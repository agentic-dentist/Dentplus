'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface StaffMember {
  id: string
  full_name: string
  email: string
  role: string
  is_active: boolean
  created_at: string
}

interface Invite {
  id: string
  email: string
  full_name: string | null
  role: string
  status: string
  expires_at: string
}

const ROLES = ['owner', 'dentist', 'hygienist', 'receptionist', 'billing']

const ROLE_COLOR: Record<string, string> = {
  owner: '#6366F1',
  dentist: '#0EA5E9',
  hygienist: '#10B981',
  receptionist: '#F59E0B',
  billing: '#F43F5E'
}

export default function TeamPage() {
  const [clinicId, setClinicId] = useState('')
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState('receptionist')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: owner } = await supabase.from('clinic_owners').select('clinic_id').eq('auth_id', user.id).single()
      if (!owner) return
      setClinicId(owner.clinic_id)

      const [{ data: staffData }, { data: inviteData }] = await Promise.all([
        supabase.from('staff_accounts').select('*').eq('clinic_id', owner.clinic_id).order('created_at'),
        supabase.from('staff_invites').select('*').eq('clinic_id', owner.clinic_id).eq('status', 'pending').order('created_at', { ascending: false })
      ])

      setStaff(staffData || [])
      setInvites(inviteData || [])
      setLoading(false)
    }
    load()
  }, [])

  const sendInvite = async () => {
    if (!inviteEmail) { setError('Email is required.'); return }
    setSending(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: owner } = await supabase.from('clinic_owners').select('id').eq('auth_id', user.id).single()
    if (!owner) return

    const { data, error: inviteError } = await supabase.from('staff_invites').insert({
      clinic_id: clinicId,
      invited_by: owner.id,
      email: inviteEmail,
      full_name: inviteName || null,
      role: inviteRole
    }).select().single()

    if (inviteError) { setError('Failed to create invite.'); setSending(false); return }

    setInvites(prev => [data, ...prev])
    setInviteEmail('')
    setInviteName('')
    setSent(true)
    setSending(false)
    setTimeout(() => setSent(false), 3000)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700&display=swap');
        .page-title { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 700; color: #0F172A; margin-bottom: 4px; }
        .page-sub { font-size: 13px; color: #94A3B8; margin-bottom: 28px; }
        .section { background: white; border-radius: 12px; border: 1px solid #E2E8F0; padding: 24px; margin-bottom: 16px; }
        .section-title { font-size: 14px; font-weight: 600; color: #0F172A; margin-bottom: 16px; }
        .invite-row { display: grid; grid-template-columns: 1fr 1fr auto auto; gap: 10px; align-items: end; }
        .field { }
        label { display: block; font-size: 12px; font-weight: 500; color: #64748B; margin-bottom: 5px; }
        input, select { width: 100%; padding: 10px 14px; border: 1.5px solid #E2E8F0; border-radius: 8px; font-size: 14px; font-family: 'DM Sans', sans-serif; color: #0F172A; outline: none; transition: border-color 0.15s; background: white; }
        input:focus, select:focus { border-color: #0F172A; }
        .invite-btn { padding: 10px 18px; background: #0F172A; color: white; border-radius: 8px; font-size: 13px; font-weight: 500; font-family: 'DM Sans', sans-serif; cursor: pointer; border: none; white-space: nowrap; height: 42px; transition: background 0.15s; }
        .invite-btn:hover { background: #1E293B; }
        .invite-btn.sent { background: #10B981; }
        .invite-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .error { background: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px; padding: 8px 12px; font-size: 12px; color: #DC2626; margin-top: 8px; }
        .staff-row { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid #F8FAFC; }
        .staff-row:last-child { border-bottom: none; }
        .avatar { width: 36px; height: 36px; border-radius: 50%; background: #F1F5F9; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 600; color: #64748B; flex-shrink: 0; }
        .staff-info { flex: 1; }
        .staff-name { font-size: 14px; font-weight: 500; color: #0F172A; }
        .staff-email { font-size: 12px; color: #94A3B8; margin-top: 1px; }
        .role-badge { font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 20px; text-transform: capitalize; }
        .invite-item { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid #F8FAFC; }
        .invite-item:last-child { border-bottom: none; }
        .invite-email { font-size: 13px; color: #64748B; flex: 1; }
        .pending-badge { font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 20px; background: #FEF3C7; color: #92400E; }
        .empty { text-align: center; padding: 24px; color: #CBD5E1; font-size: 13px; }
      `}</style>

      <div className="page-title">Team</div>
      <div className="page-sub">Manage your clinic staff and send invitations</div>

      <div className="section">
        <div className="section-title">Invite a team member</div>
        <div className="invite-row">
          <div className="field">
            <label>Email</label>
            <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="staff@clinic.com" />
          </div>
          <div className="field">
            <label>Name (optional)</label>
            <input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Dr. Smith" />
          </div>
          <div className="field">
            <label>Role</label>
            <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
              {ROLES.filter(r => r !== 'owner').map(r => (
                <option key={r} value={r} style={{ textTransform: 'capitalize' }}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
              ))}
            </select>
          </div>
          <button className={`invite-btn ${sent ? 'sent' : ''}`} onClick={sendInvite} disabled={sending}>
            {sending ? '...' : sent ? 'Sent!' : 'Send invite'}
          </button>
        </div>
        {error && <div className="error">{error}</div>}
      </div>

      <div className="section">
        <div className="section-title">Active staff ({staff.length})</div>
        {loading ? <div className="empty">Loading...</div> : staff.length === 0 ? (
          <div className="empty">No staff members yet</div>
        ) : staff.map(s => (
          <div key={s.id} className="staff-row">
            <div className="avatar">{s.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}</div>
            <div className="staff-info">
              <div className="staff-name">{s.full_name}</div>
              <div className="staff-email">{s.email}</div>
            </div>
            <span className="role-badge" style={{ background: `${ROLE_COLOR[s.role]}18`, color: ROLE_COLOR[s.role] }}>
              {s.role}
            </span>
          </div>
        ))}
      </div>

      {invites.length > 0 && (
        <div className="section">
          <div className="section-title">Pending invites ({invites.length})</div>
          {invites.map(inv => (
            <div key={inv.id} className="invite-item">
              <div className="invite-email">{inv.email}{inv.full_name ? ` — ${inv.full_name}` : ''}</div>
              <span className="role-badge" style={{ background: `${ROLE_COLOR[inv.role]}18`, color: ROLE_COLOR[inv.role] }}>
                {inv.role}
              </span>
              <span className="pending-badge">Pending</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
