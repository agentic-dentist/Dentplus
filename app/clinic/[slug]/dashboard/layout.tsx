'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ClinicContext, ClinicUser } from './clinic-context'

type Role = 'owner' | 'dentist' | 'hygienist' | 'receptionist' | 'billing'
interface NavItem { icon: string; label: string; path: string }

const BASE_NAV: Record<Role, NavItem[]> = {
  owner: [
    { icon: '▦', label: 'Overview',  path: 'dashboard' },
    { icon: '◈', label: 'Patients',  path: 'dashboard/patients' },
    { icon: '◷', label: 'Schedule',  path: 'dashboard/schedule' },
    { icon: '⬡', label: 'AI Agent',  path: 'dashboard/agent' },
    { icon: '◎', label: 'Reports',   path: 'dashboard/reports' },
    { icon: '◑', label: 'Waitlist',  path: 'dashboard/waitlist' },
    { icon: '→', label: 'Referrals', path: 'dashboard/referrals' },
    { icon: '↺', label: 'Recall',    path: 'dashboard/recall' },
  ],
  dentist: [
    { icon: '▦', label: 'Overview',     path: 'dashboard' },
    { icon: '◈', label: 'Patients',     path: 'dashboard/patients' },
    { icon: '◷', label: 'Schedule',     path: 'dashboard/schedule' },
    { icon: '⬡', label: 'AI Agent',     path: 'dashboard/agent' },
    { icon: '◎', label: 'Reports',      path: 'dashboard/reports' },
    { icon: '◑', label: 'Waitlist',     path: 'dashboard/waitlist' },
    { icon: '→', label: 'Referrals',    path: 'dashboard/referrals' },
    { icon: '🗓', label: 'My Schedule', path: 'dashboard/my-schedule' },
  ],
  hygienist: [
    { icon: '▦', label: 'Overview',     path: 'dashboard' },
    { icon: '◈', label: 'Patients',     path: 'dashboard/patients' },
    { icon: '◷', label: 'Schedule',     path: 'dashboard/schedule' },
    { icon: '◑', label: 'Waitlist',     path: 'dashboard/waitlist' },
    { icon: '🗓', label: 'My Schedule', path: 'dashboard/my-schedule' },
  ],
  receptionist: [
    { icon: '▦', label: 'Overview',  path: 'dashboard' },
    { icon: '◈', label: 'Patients',  path: 'dashboard/patients' },
    { icon: '◷', label: 'Schedule',  path: 'dashboard/schedule' },
    { icon: '⬡', label: 'AI Agent',  path: 'dashboard/agent' },
    { icon: '◑', label: 'Waitlist',  path: 'dashboard/waitlist' },
    { icon: '↺', label: 'Recall',    path: 'dashboard/recall' },
  ],
  billing: [
    { icon: '▦', label: 'Overview', path: 'dashboard' },
    { icon: '◈', label: 'Patients', path: 'dashboard/patients' },
    { icon: '◎', label: 'Reports',  path: 'dashboard/reports' },
  ],
}

const OWNER_EXTRA_NAV: NavItem[] = [
  { icon: '👥', label: 'Team',     path: 'dashboard/team' },
  { icon: '💳', label: 'Billing',  path: 'dashboard/billing' },
  { icon: '◉', label: 'Settings', path: 'dashboard/settings' },
]
const STAFF_SETTINGS: NavItem[] = [
  { icon: '◉', label: 'Settings', path: 'dashboard/settings' },
]
const ROLE_LABEL: Record<Role, string> = {
  owner: 'Clinic owner', dentist: 'Dentist',
  hygienist: 'Hygienist', receptionist: 'Receptionist', billing: 'Billing',
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()

  const [slug, setSlug]           = useState('demo')
  const [role, setRole]           = useState<Role>('receptionist')
  const [isOwner, setIsOwner]     = useState(false)
  const [clinicName, setClinicName] = useState('')
  const [staffName, setStaffName] = useState('')
  const [pulse, setPulse]         = useState(false)
  const [clinicUser, setClinicUser] = useState<ClinicUser>({
    clinicId: '', staffId: '', staffName: '', staffRole: '', isOwner: false, clinicName: '',
  })

  useEffect(() => {
    const hostname  = window.location.hostname
    const realSlug  = hostname.includes('.dentplus.ca')
      ? hostname.replace('.dentplus.ca', '')
      : (pathname.split('/')[2] || 'demo')
    setSlug(realSlug)

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push(`/clinic/${realSlug}/login?type=staff`); return }

      const { data: staff } = await supabase
        .from('staff_accounts')
        .select('id, role, full_name, clinic_id, clinics(name)')
        .eq('auth_id', user.id)
        .maybeSingle()

      if (staff) {
        const clinic = Array.isArray(staff.clinics) ? staff.clinics[0] : staff.clinics
        const name   = (clinic as { name: string })?.name || ''
        setRole(staff.role as Role)
        setStaffName(staff.full_name)
        setClinicName(name)
        const { data: ownerCheck } = await supabase
          .from('clinic_owners').select('id').eq('auth_id', user.id).maybeSingle()
        setIsOwner(!!ownerCheck)
        setClinicUser({ clinicId: staff.clinic_id, staffId: staff.id, staffName: staff.full_name, staffRole: staff.role, isOwner: !!ownerCheck, clinicName: name })
        return
      }

      const { data: owner } = await supabase
        .from('clinic_owners')
        .select('clinic_id, clinics(name)')
        .eq('auth_id', user.id)
        .maybeSingle()

      if (owner) {
        const clinic    = Array.isArray(owner.clinics) ? owner.clinics[0] : owner.clinics
        const name      = (clinic as { name: string })?.name || ''
        const fullName  = user.user_metadata?.full_name || 'Clinic Owner'
        const ownerEmail = (user.email || '').trim().toLowerCase()
        setRole('owner'); setIsOwner(true); setClinicName(name); setStaffName(fullName)

        let ownerStaffId = ''
        const { data: existingStaff } = await supabase.from('staff_accounts').select('id').eq('auth_id', user.id).maybeSingle()
        if (existingStaff) {
          ownerStaffId = existingStaff.id
        } else {
          const { data: newStaff } = await supabase.from('staff_accounts')
            .insert({ auth_id: user.id, clinic_id: owner.clinic_id, email: ownerEmail, full_name: fullName, role: 'owner', is_active: true })
            .select('id').single()
          ownerStaffId = newStaff?.id || ''
        }
        setClinicUser({ clinicId: owner.clinic_id, staffId: ownerStaffId, staffName: fullName, staffRole: 'owner', isOwner: true, clinicName: name })
        return
      }

      router.push(`/clinic/${realSlug}`)
    }
    init()
  }, [pathname])

  useEffect(() => {
    const p = setInterval(() => setPulse(v => !v), 2000)
    return () => clearInterval(p)
  }, [])

  const signOut = async () => { await supabase.auth.signOut(); router.push(`/clinic/${slug}`) }

  const baseNav  = BASE_NAV[role] || BASE_NAV.receptionist
  const extraNav = isOwner ? OWNER_EXTRA_NAV : STAFF_SETTINGS

  const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Inter',sans-serif;background:#F1F5F9;color:#0F172A;-webkit-font-smoothing:antialiased}
    .dp-layout{display:flex;min-height:100vh}
    .dp-sidebar{width:236px;background:#FFFFFF;border-right:1px solid #E2E8F0;display:flex;flex-direction:column;position:fixed;top:0;left:0;height:100vh;z-index:50}
    .dp-logo-area{padding:20px 20px 16px;border-bottom:1px solid #E2E8F0}
    .dp-logo-mark{display:flex;align-items:center;gap:10px;margin-bottom:6px}
    .dp-logo-icon{width:32px;height:32px;background:#00C4A7;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
    .dp-logo-text{font-family:'Syne',sans-serif;font-size:17px;font-weight:700;color:#0F172A;letter-spacing:-0.3px}
    .dp-clinic-name{font-size:12px;color:#64748B;font-weight:500;padding-left:42px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .dp-ai-pill{margin:12px 14px;padding:8px 12px;background:#EEF2FF;border:1px solid #C7D2FE;border-radius:8px;display:flex;align-items:center;gap:8px}
    .dp-ai-dot{width:6px;height:6px;border-radius:50%;background:#4F46E5;flex-shrink:0;transition:opacity 1s ease}
    .dp-ai-dot.off{opacity:.2}
    .dp-ai-label{font-size:12px;color:#4F46E5;font-weight:600}
    .dp-nav{padding:8px 10px;flex:1;overflow-y:auto}
    .dp-nav-section{font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#94A3B8;padding:14px 12px 5px}
    .dp-nav-divider{height:1px;background:#F1F5F9;margin:6px 10px}
    .dp-nav-btn{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:8px;color:#334155;font-size:13px;font-weight:500;cursor:pointer;margin-bottom:2px;transition:all .12s;border:none;background:none;width:100%;text-align:left;font-family:'Inter',sans-serif}
    .dp-nav-btn:hover{background:#F8FAFC;color:#0F172A}
    .dp-nav-btn.active{background:#FFFFFF;color:#4F46E5;font-weight:600;border-left:3px solid #4F46E5;padding-left:9px;box-shadow:0 1px 4px rgba(0,0,0,.07)}
    .dp-nav-icon{font-size:13px;width:18px;text-align:center;flex-shrink:0}
    .dp-role-badge{margin:0 14px 8px;padding:5px 12px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;font-size:11px;font-weight:600;color:#64748B;text-align:center}
    .dp-role-badge.owner{background:#EEF2FF;border-color:#C7D2FE;color:#4F46E5}
    .dp-widget-btn{margin:0 12px 10px;padding:9px 14px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;color:#64748B;font-size:12px;font-weight:500;font-family:'Inter',sans-serif;cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:8px}
    .dp-widget-btn:hover{border-color:#4F46E5;color:#4F46E5;background:#EEF2FF}
    .dp-widget-dot{width:5px;height:5px;border-radius:50%;background:#00C4A7;flex-shrink:0}
    .dp-footer{padding:14px 20px 18px;border-top:1px solid #E2E8F0}
    .dp-staff-name{font-size:13px;color:#0F172A;font-weight:500;margin-bottom:3px}
    .dp-signout{font-size:12px;color:#94A3B8;background:none;border:none;cursor:pointer;font-family:'Inter',sans-serif;padding:0;transition:color .15s}
    .dp-signout:hover{color:#4F46E5}
    .dp-main{flex:1;margin-left:236px;padding:32px 36px;min-height:100vh}
    .card-box{background:#FFFFFF;border:1px solid #E2E8F0;border-radius:14px;overflow:hidden}
    .page-heading{font-family:'Syne',sans-serif;font-size:22px;font-weight:700;color:#0F172A;margin-bottom:4px}
    .page-sub{font-size:13px;color:#94A3B8;margin-bottom:24px}
    .stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:22px}
    .stat-card{background:#FFFFFF;border:1px solid #E2E8F0;border-radius:14px;padding:18px 20px}
    .stat-card.primary{background:#4F46E5;border-color:#4F46E5}
    .stat-card-label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:8px}
    .stat-card.primary .stat-card-label{color:rgba(255,255,255,.65)}
    .stat-card-val{font-family:'Syne',sans-serif;font-size:28px;font-weight:800;color:#0F172A;line-height:1}
    .stat-card.primary .stat-card-val{color:#FFFFFF}
    .stat-card-sub{font-size:11px;color:#94A3B8;margin-top:5px;font-weight:500}
    .stat-card.primary .stat-card-sub{color:rgba(255,255,255,.6)}
    .dp-table{width:100%;border-collapse:collapse}
    .dp-table th{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;padding:10px 16px;text-align:left;border-bottom:1px solid #F1F5F9;background:#FAFAFA}
    .dp-table td{font-size:13px;color:#334155;padding:13px 16px;border-bottom:1px solid #F8FAFC}
    .dp-table tr:last-child td{border-bottom:none}
    .dp-table tr:hover td{background:#FAFAFA}
    .btn-primary{padding:9px 20px;background:#4F46E5;color:#FFFFFF;border:none;border-radius:8px;font-size:13px;font-weight:600;font-family:'Inter',sans-serif;cursor:pointer;transition:all .15s}
    .btn-primary:hover{background:#4338CA}
    .btn-secondary{padding:9px 16px;background:#FFFFFF;color:#334155;border:1px solid #E2E8F0;border-radius:8px;font-size:13px;font-weight:500;font-family:'Inter',sans-serif;cursor:pointer;transition:all .15s}
    .btn-secondary:hover{border-color:#CBD5E1;background:#F8FAFC}
    .badge{padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;display:inline-block}
    .badge-green{background:#D1FAE5;color:#059669}
    .badge-yellow{background:#FEF3C7;color:#D97706}
    .badge-blue{background:#EEF2FF;color:#4F46E5}
    .badge-red{background:#FEE2E2;color:#DC2626}
    .badge-gray{background:#F1F5F9;color:#64748B}
    .badge-teal{background:#E6FAF7;color:#009E87}
    .dp-tabs{display:flex;gap:4px;background:#F1F5F9;border-radius:10px;padding:4px;width:fit-content;margin-bottom:22px}
    .dp-tab{padding:7px 18px;border:none;border-radius:7px;font-size:13px;font-weight:500;font-family:'Inter',sans-serif;cursor:pointer;color:#64748B;background:none;transition:all .12s}
    .dp-tab.active{background:#FFFFFF;color:#0F172A;box-shadow:0 1px 4px rgba(0,0,0,.07)}
    .dp-input{width:100%;padding:9px 12px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:13px;font-family:'Inter',sans-serif;outline:none;transition:border-color .15s;background:#FFFFFF;color:#0F172A}
    .dp-input:focus{border-color:#4F46E5}
    .dp-select{width:100%;padding:9px 12px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:13px;font-family:'Inter',sans-serif;outline:none;background:#FFFFFF;color:#0F172A;cursor:pointer}
    .dp-label{display:block;font-size:11px;font-weight:600;color:#64748B;margin-bottom:5px;text-transform:uppercase;letter-spacing:.5px}
    .dp-empty{padding:48px;text-align:center;color:#CBD5E1;font-size:14px}
    .dp-empty-icon{font-size:32px;margin-bottom:12px;opacity:.4}
    .no-data{padding:32px;text-align:center;color:#CBD5E1;font-size:13px}
    ::-webkit-scrollbar{width:5px;height:5px}
    ::-webkit-scrollbar-track{background:transparent}
    ::-webkit-scrollbar-thumb{background:#E2E8F0;border-radius:10px}
    ::-webkit-scrollbar-thumb:hover{background:#CBD5E1}
  `

  return (
    <ClinicContext.Provider value={clinicUser}>
      <>
        <style>{CSS}</style>
        <div className="dp-layout">
          <aside className="dp-sidebar">
            <div className="dp-logo-area">
              <div className="dp-logo-mark">
                <div className="dp-logo-icon">🦷</div>
                <div className="dp-logo-text">DentPlus</div>
              </div>
              <div className="dp-clinic-name">{clinicName || 'Loading…'}</div>
            </div>

            <div className="dp-ai-pill">
              <div className={`dp-ai-dot ${pulse ? '' : 'off'}`} />
              <div className="dp-ai-label">AI Agent · Online</div>
            </div>

            <nav className="dp-nav">
              <div className="dp-nav-section">Workspace</div>
              {baseNav.map(item => {
                const href = `/clinic/${slug}/${item.path}`
                return (
                  <button key={item.path} className={`dp-nav-btn ${pathname === href ? 'active' : ''}`}
                    onClick={() => router.push(href)}>
                    <span className="dp-nav-icon">{item.icon}</span>
                    {item.label}
                  </button>
                )
              })}
              <div className="dp-nav-divider" />
              {isOwner && <div className="dp-nav-section">Clinic</div>}
              {extraNav.map(item => {
                const href = `/clinic/${slug}/${item.path}`
                return (
                  <button key={item.path} className={`dp-nav-btn ${pathname === href ? 'active' : ''}`}
                    onClick={() => router.push(href)}>
                    <span className="dp-nav-icon">{item.icon}</span>
                    {item.label}
                  </button>
                )
              })}
            </nav>

            <div className={`dp-role-badge ${isOwner ? 'owner' : ''}`}>{ROLE_LABEL[role]}</div>

            <button className="dp-widget-btn" onClick={() => window.open(`/clinic/${slug}/book`, '_blank')}>
              <div className="dp-widget-dot" />
              Open patient widget
            </button>

            <div className="dp-footer">
              <div className="dp-staff-name">{staffName}</div>
              <button className="dp-signout" onClick={signOut}>Sign out →</button>
            </div>
          </aside>

          <main className="dp-main">{children}</main>
        </div>
      </>
    </ClinicContext.Provider>
  )
}
