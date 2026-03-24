'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Role = 'owner' | 'dentist' | 'hygienist' | 'receptionist' | 'billing'

interface NavItem { icon: string; label: string; path: string }

const BASE_NAV: Record<Role, NavItem[]> = {
  owner: [
    { icon: '▦', label: 'Overview',  path: 'dashboard' },
    { icon: '◈', label: 'Patients',  path: 'dashboard/patients' },
    { icon: '◷', label: 'Schedule',  path: 'dashboard/schedule' },
    { icon: '⬡', label: 'AI Agent',  path: 'dashboard/agent' },
    { icon: '◎', label: 'Reports',   path: 'dashboard/reports' },
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
  ],
  billing: [
    { icon: '▦', label: 'Overview',  path: 'dashboard' },
    { icon: '◈', label: 'Patients',  path: 'dashboard/patients' },
    { icon: '◎', label: 'Reports',   path: 'dashboard/reports' },
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

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const [slug, setSlug] = useState('demo')
  const [role, setRole] = useState<Role>('receptionist')
  const [isOwner, setIsOwner] = useState(false)
  const [clinicName, setClinicName] = useState('')
  const [staffName, setStaffName] = useState('')
  const [pulse, setPulse] = useState(false)
  const [time, setTime] = useState('')

  useEffect(() => {
    const parts = pathname.split('/')
    const slugFromPath = parts[2] || 'demo'
    setSlug(slugFromPath)

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push(`/clinic/${slugFromPath}/login?type=staff`); return }

      const { data: staff } = await supabase
        .from('staff_accounts')
        .select('role, full_name, clinic_id, clinics(name)')
        .eq('auth_id', user.id)
        .single()

      if (!staff) { router.push(`/clinic/${slugFromPath}`); return }

      setRole(staff.role as Role)
      setStaffName(staff.full_name)
      const clinic = Array.isArray(staff.clinics) ? staff.clinics[0] : staff.clinics
      setClinicName((clinic as { name: string })?.name || '')

      // Check if also a clinic owner
      const { data: owner } = await supabase
        .from('clinic_owners')
        .select('id')
        .eq('auth_id', user.id)
        .single()

      setIsOwner(!!owner)
    }
    init()
  }, [pathname])

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-CA', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false, timeZone: 'America/Toronto'
    }))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const p = setInterval(() => setPulse(v => !v), 2000)
    return () => clearInterval(p)
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push(`/clinic/${slug}`)
  }

  // Build nav: base role nav + owner extras (if owner) + settings
  const baseNav = BASE_NAV[role] || BASE_NAV.receptionist
  const extraNav = isOwner ? OWNER_EXTRA_NAV : STAFF_SETTINGS

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&family=DM+Sans:wght@300;400;500;600&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'DM Sans',sans-serif;background:#F0F4F8;color:#0F172A}
        .layout{display:flex;min-height:100vh}
        .sidebar{width:240px;background:#0F172A;display:flex;flex-direction:column;position:fixed;top:0;left:0;height:100vh;z-index:50}
        .logo-area{padding:26px 20px 20px;border-bottom:1px solid rgba(255,255,255,0.06)}
        .logo-mark{display:flex;align-items:center;gap:10px;margin-bottom:3px}
        .logo-icon{width:30px;height:30px;background:#0EA5E9;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:15px}
        .logo-text{font-family:'Syne',sans-serif;font-size:16px;font-weight:700;color:#F8FAFC;letter-spacing:-0.3px}
        .logo-sub{font-size:11px;color:rgba(148,163,184,0.5);padding-left:40px}
        .clock{font-family:'JetBrains Mono',monospace;font-size:10px;color:rgba(148,163,184,0.35);margin-top:10px;letter-spacing:1.5px}
        .ai-status{margin:12px 16px;padding:8px 12px;background:rgba(14,165,233,0.07);border:1px solid rgba(14,165,233,0.15);border-radius:7px;display:flex;align-items:center;gap:8px}
        .ai-pulse{width:6px;height:6px;border-radius:50%;background:#0EA5E9;flex-shrink:0;transition:box-shadow 1s ease,opacity 1s ease}
        .ai-pulse.on{box-shadow:0 0 0 3px rgba(14,165,233,0.2)}
        .ai-pulse.off{opacity:.3;box-shadow:none}
        .ai-status-text{font-size:11px;color:#0EA5E9;font-weight:500;letter-spacing:.3px}
        .nav{padding:8px 10px;flex:1;overflow-y:auto}
        .nav-label{font-size:9.5px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:rgba(148,163,184,0.25);padding:12px 10px 6px}
        .nav-divider{height:1px;background:rgba(255,255,255,0.05);margin:8px 10px}
        .nav-item{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:7px;color:rgba(148,163,184,0.5);font-size:13px;cursor:pointer;margin-bottom:1px;transition:all .15s;border:none;background:none;width:100%;text-align:left;font-family:'DM Sans',sans-serif;position:relative}
        .nav-item:hover{background:rgba(255,255,255,0.05);color:#CBD5E1}
        .nav-item.active{background:rgba(14,165,233,0.1);color:#0EA5E9;font-weight:500}
        .nav-item.active::before{content:'';position:absolute;left:0;top:50%;transform:translateY(-50%);width:2px;height:55%;background:#0EA5E9;border-radius:0 2px 2px 0}
        .nav-icon{font-size:13px;width:18px;text-align:center}
        .role-badge{margin:0 16px 6px;padding:3px 10px;background:rgba(255,255,255,0.04);border-radius:20px;font-size:10px;font-weight:600;color:rgba(148,163,184,0.3);text-transform:uppercase;letter-spacing:1px;text-align:center}
        .owner-badge{margin:0 16px 8px;padding:3px 10px;background:rgba(14,165,233,0.08);border:1px solid rgba(14,165,233,0.15);border-radius:20px;font-size:10px;font-weight:600;color:#0EA5E9;text-transform:uppercase;letter-spacing:1px;text-align:center}
        .widget-btn{margin:0 12px 12px;padding:10px 14px;background:rgba(14,165,233,0.08);border:1px solid rgba(14,165,233,0.2);border-radius:8px;color:#0EA5E9;font-size:12px;font-weight:500;font-family:'DM Sans',sans-serif;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:8px}
        .widget-btn:hover{background:rgba(14,165,233,0.14)}
        .widget-dot{width:5px;height:5px;border-radius:50%;background:#0EA5E9;box-shadow:0 0 6px rgba(14,165,233,0.8)}
        .sidebar-footer{padding:14px 20px 20px;border-top:1px solid rgba(255,255,255,0.06)}
        .staff-name{font-size:13px;color:#CBD5E1;font-weight:500;margin-bottom:2px}
        .signout{font-size:12px;color:rgba(148,163,184,0.4);background:none;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;padding:0;transition:color .15s}
        .signout:hover{color:#94A3B8}
        .main{flex:1;margin-left:240px;padding:36px 40px;min-height:100vh}
      `}</style>

      <div className="layout">
        <aside className="sidebar">
          <div className="logo-area">
            <div className="logo-mark">
              <div className="logo-icon">🦷</div>
              <div className="logo-text">DentPlus</div>
            </div>
            <div className="logo-sub">{clinicName || 'Loading...'}</div>
            <div className="clock">{time || '00:00:00'}</div>
          </div>

          <div className="ai-status">
            <div className={`ai-pulse ${pulse ? 'on' : 'off'}`} />
            <div className="ai-status-text">AI Agent · Online</div>
          </div>

          <nav className="nav">
            <div className="nav-label">Workspace</div>
            {baseNav.map(item => {
              const href = `/clinic/${slug}/${item.path}`
              return (
                <button key={item.path} className={`nav-item ${pathname === href ? 'active' : ''}`}
                  onClick={() => router.push(href)}>
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                </button>
              )
            })}

            {/* Owner-only or settings section */}
            <div className="nav-divider" />
            {isOwner && <div className="nav-label">Clinic management</div>}
            {extraNav.map(item => {
              const href = `/clinic/${slug}/${item.path}`
              return (
                <button key={item.path} className={`nav-item ${pathname === href ? 'active' : ''}`}
                  onClick={() => router.push(href)}>
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                </button>
              )
            })}
          </nav>

          {isOwner
            ? <div className="owner-badge">Clinic owner</div>
            : <div className="role-badge">{role}</div>
          }

          <button className="widget-btn" onClick={() => window.open(`/clinic/${slug}/book`, '_blank')}>
            <div className="widget-dot" />
            Open patient widget
          </button>

          <div className="sidebar-footer">
            <div className="staff-name">{staffName}</div>
            <button className="signout" onClick={signOut}>Sign out</button>
          </div>
        </aside>

        <main className="main">{children}</main>
      </div>
    </>
  )
}
